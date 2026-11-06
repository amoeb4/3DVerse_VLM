import * as THREE from "three";
import {
  getAssetDescription,
  getAssetPayload,
  type GetAssetDescription_Channel,
  type GetAssetDescription_Mesh,
} from "@3dverse/api";

import { PUBLIC_TOKEN } from "../../config";
import { decodeLz4Frame, isLz4Frame } from "./lz4";

/**
 * Mesh assets fetched from the 3dverse API, for the parts of the HUD that follow the real geometry.
 *
 * A mesh asset is a description (its submeshes, and where each one's channels sit in the payload)
 * and a binary payload, `GET /assets/meshes/:id/payload`, served as a raw LZ4 frame. Entities point
 * at one submesh of it (`mesh_ref.submeshIndex`), and a whole machine is often a single asset, so it
 * is fetched and decoded once and shared by every part.
 */

type MeshAsset = {
  description: GetAssetDescription_Mesh;
  data: ArrayBuffer;
  /** Submesh geometries already read from `data`, by index. Never rendered as is: callers clone. */
  geometries: Map<number, THREE.BufferGeometry>;
};

// The same token the Livelink session is opened with; the API takes it as a user token.
const HEADERS = { user_token: PUBLIC_TOKEN } as unknown as Parameters<
  typeof getAssetPayload
>[1];

const assets = new Map<string, Promise<MeshAsset>>();

/** The mesh asset `meshId`, fetched and decoded on first use, then shared. */
export function loadMeshAsset(meshId: string): Promise<MeshAsset> {
  let pending = assets.get(meshId);
  if (!pending) {
    pending = fetchMeshAsset(meshId);
    assets.set(meshId, pending);
    // A failed fetch is retried the next time it is asked for, not cached.
    pending.catch(() => assets.delete(meshId));
  }
  return pending;
}

async function fetchMeshAsset(meshId: string): Promise<MeshAsset> {
  const [{ data: description }, { data: payload }] = await Promise.all([
    getAssetDescription(
      { asset_container: "meshes", asset_id: meshId },
      HEADERS,
    ),
    getAssetPayload(
      { asset_container_with_payload: "meshes", asset_id: meshId },
      HEADERS,
      "arraybuffer",
    ),
  ]);
  const mesh = description as GetAssetDescription_Mesh;

  let bytes = new Uint8Array(payload);
  if (isLz4Frame(bytes)) {
    bytes = decodeLz4Frame(bytes, mesh.payloadSize);
  }
  if (bytes.length !== mesh.payloadSize) {
    throw new Error(
      `Mesh ${meshId}: payload is ${bytes.length} bytes, its description says ${mesh.payloadSize}`,
    );
  }
  const data =
    bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
      ? (bytes.buffer as ArrayBuffer)
      : (bytes.slice().buffer as ArrayBuffer);

  return { description: mesh, data, geometries: new Map() };
}

/**
 * Submesh `index` of a mesh asset, as a geometry with positions, normals and indices, in the
 * submesh's own space. Shared and cached: clone it before transforming it.
 */
export function submeshGeometry(
  asset: MeshAsset,
  index: number,
): THREE.BufferGeometry | null {
  const cached = asset.geometries.get(index);
  if (cached) {
    return cached;
  }
  const submesh = asset.description.submeshes[index];
  if (!submesh) {
    return null;
  }
  const channel = (semantic: GetAssetDescription_Channel["semantic"]) =>
    submesh.channels.find((c) => c.semantic === semantic);

  const position = channel("position");
  if (!position) {
    return null;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(readFloats(asset.data, position), 3),
  );

  const indices = channel("index");
  if (indices && submesh.indexCount > 0) {
    geometry.setIndex(
      new THREE.BufferAttribute(readIndices(asset.data, indices), 1),
    );
  }

  const normal = channel("normal");
  if (normal) {
    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(readFloats(asset.data, normal), 3),
    );
  } else {
    geometry.computeVertexNormals();
  }

  asset.geometries.set(index, geometry);
  return geometry;
}

//------------------------------------------------------------------------------
// Channels. `elementType` is 0 for signed integers, 1 for unsigned ones, 2 for floats.
//------------------------------------------------------------------------------

/** A channel's bytes, copied: offsets in the payload are not always aligned for a typed array. */
function channelBytes(data: ArrayBuffer, channel: GetAssetDescription_Channel) {
  const end = channel.dataOffset + channel.dataSize;
  if (end > data.byteLength) {
    throw new Error(`Mesh channel "${channel.semantic}" runs past the payload`);
  }
  return data.slice(channel.dataOffset, end);
}

function readFloats(data: ArrayBuffer, channel: GetAssetDescription_Channel) {
  const bytes = channelBytes(data, channel);
  if (channel.elementType !== 2) {
    throw new Error(`Mesh channel "${channel.semantic}" is not made of floats`);
  }
  return channel.elementSize === 8
    ? Float32Array.from(new Float64Array(bytes))
    : new Float32Array(bytes);
}

function readIndices(data: ArrayBuffer, channel: GetAssetDescription_Channel) {
  const bytes = channelBytes(data, channel);
  switch (channel.elementSize) {
    case 1:
      return Uint16Array.from(new Uint8Array(bytes));
    case 2:
      return new Uint16Array(bytes);
    case 4:
      return new Uint32Array(bytes);
    default:
      throw new Error(
        `Mesh index channel has ${channel.elementSize}-byte elements`,
      );
  }
}
