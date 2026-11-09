import * as THREE from "three";

import {
  LAYER_SAMPLES,
  type BuildRecord,
  type LayerRecord,
  type SignalId,
} from "../../live/processFeed";
import {
  metricColor,
  NEUTRAL_RGB,
  type PartMetric,
  type Theme,
} from "./partColors";
import type { PartGeometry, Point3 } from "./partGeometry";

/** A point of the part: its layer, and its sample along the layer's path. */
export type PartPoint = { layer: number; sample: number };

const RADIAL_SEGMENTS = 6;
/** Drawn after the arm's veil (see `PartInCell`). */
const RENDER_ORDER = 2;
/** The faint lines of the layers still to lay, per theme. */
const GHOST_COLOR: Record<Theme, number> = { dark: 0xb9b8b2, light: 0x5c5b57 };

type LayerMesh = {
  mesh: THREE.Mesh;
  version: number;
  /** How far along the path the tube goes, 0–1. */
  drawn: number;
  tubularSegments: number;
};

/** A sample's value for a signal, `null` where nothing was measured. */
const sampleValue = (record: LayerRecord, index: number) => (id: SignalId) => {
  const v = record.samples[id][index];
  return Number.isNaN(v) ? null : v;
};

/**
 * The part in construction, as a Three.js group in its own space (millimetres, Y up, standing on
 * y = 0): one tube per layer laid, along its path, coloured sample by sample by a metric; the
 * layers still to lay as faint lines when `ghost` is on; a ring around a layer to find it; a dot on
 * the point under the pointer. It carries its own lights.
 *
 * Whoever shows it places `root` (in the cell, on the build plate: `PartInCell`) and redraws.
 */
export class PartModel {
  readonly root = new THREE.Group();

  readonly #geometry: PartGeometry;
  // Transparent (at full opacity) so it is drawn after Part mode's veil, which is: Three.js draws
  // transparent objects after opaque ones, whatever their render order.
  readonly #material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.45,
    metalness: 0.15,
    transparent: true,
  });
  readonly #ghostMaterial = new THREE.LineBasicMaterial({
    color: GHOST_COLOR.light,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  readonly #layers = new Map<number, LayerMesh>();
  readonly #ghosts: THREE.LineLoop[] = [];
  readonly #hoverMarker: THREE.Mesh;
  #focusHalo: THREE.Mesh | null = null;

  #records: readonly LayerRecord[] = [];
  #metric: PartMetric = "temperature";
  #theme: Theme = "light";
  #shownLayer = Infinity;
  #ghostOn = false;
  #focusLayer: number | null = null;

  constructor(geometry: PartGeometry) {
    this.#geometry = geometry;
    this.root.matrixAutoUpdate = false;
    // Hidden, and so not pickable, until it is placed on its plate (`PartInCell`): before the scene
    // is ready, its matrix is the identity and the overlay's camera not yet the viewport's.
    this.root.visible = false;

    // Its own light, so its colours read the same wherever it stands in the cell.
    this.root.add(new THREE.HemisphereLight(0xffffff, 0x505050, 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(300, 500, 250);
    this.root.add(key, key.target);

    geometry.layers.forEach((path) => {
      const ghost = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(
          path.map((p) => new THREE.Vector3(...p)),
        ),
        this.#ghostMaterial,
      );
      ghost.renderOrder = RENDER_ORDER;
      ghost.visible = false;
      this.#ghosts.push(ghost);
      this.root.add(ghost);
    });

    this.#hoverMarker = new THREE.Mesh(
      new THREE.SphereGeometry(geometry.beadRadius * 2.2, 16, 12),
      // Transparent (at full opacity) so it is drawn after Part mode's veil, which is.
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        depthTest: false,
        transparent: true,
      }),
    );
    this.#hoverMarker.renderOrder = RENDER_ORDER + 1;
    this.#hoverMarker.visible = false;
    this.root.add(this.#hoverMarker);
  }

  /** The part's centre, in its own space. */
  get center(): Point3 {
    return this.#geometry.center;
  }

  /** The part's size across, in its own units. */
  get size(): number {
    return this.#geometry.size;
  }

  /**
   * Where the bead is being laid: the front of the last layer shown, along its path, in the
   * overlay's (the cell's) space — as of the last draw, which placed the part. `null` before any
   * layer, or while the part is not placed.
   */
  weldPoint(target = new THREE.Vector3()): THREE.Vector3 | null {
    if (!this.root.visible) return null;
    for (let index = this.#records.length - 1; index >= 0; index -= 1) {
      const record = this.#records[index];
      if (!record || record.layer > this.#shownLayer || record.progress <= 0) {
        continue;
      }
      const curve = this.#curveOf(record.layer);
      if (!curve) return null;
      return curve
        .getPointAt(Math.min(1, record.progress) % 1, target)
        .applyMatrix4(this.root.matrixWorld);
    }
    return null;
  }

  readonly #curves = new Map<number, THREE.CatmullRomCurve3>();

  /** A layer's whole path as a curve, for points along it by length; cached, the paths are fixed. */
  #curveOf(layer: number): THREE.CatmullRomCurve3 | null {
    let curve = this.#curves.get(layer);
    if (!curve) {
      const path = this.#geometry.layers[layer - 1];
      if (!path || path.length < 2) return null;
      curve = new THREE.CatmullRomCurve3(
        path.map((p) => new THREE.Vector3(...p)),
        this.#geometry.closed,
        "centripetal",
      );
      this.#curves.set(layer, curve);
    }
    return curve;
  }

  //----------------------------------------------------------------------------
  update(build: BuildRecord) {
    this.#records = build.records;
    // A new part has started: the old one's layers go.
    for (const [layer, entry] of this.#layers) {
      if (!build.records[layer - 1]) this.#removeLayer(layer, entry);
    }
    for (const record of build.records) {
      if (!record) continue;
      const entry = this.#layers.get(record.layer);
      if (!entry || entry.version !== record.version) this.#buildLayer(record);
    }
    this.#applyVisibility();
  }

  setMetric(metric: PartMetric) {
    if (metric === this.#metric) return;
    this.#metric = metric;
    this.#recolorAll();
  }

  setTheme(theme: Theme) {
    if (theme === this.#theme) return;
    this.#theme = theme;
    this.#ghostMaterial.color.set(GHOST_COLOR[theme]);
    this.#recolorAll();
  }

  /** Shows the part as it was once `layer` was laid; `Infinity` for all of it. */
  setShownLayer(layer: number) {
    this.#shownLayer = layer;
    this.#applyVisibility();
  }

  /** The layers still to lay, as faint lines: the shape the part is heading for. */
  setGhost(on: boolean) {
    this.#ghostOn = on;
    this.#applyVisibility();
  }

  /** Rings one layer, to find it on the part; `null` for none. */
  setFocusLayer(layer: number | null) {
    if (layer === this.#focusLayer) return;
    this.#focusLayer = layer;
    if (this.#focusHalo) {
      this.root.remove(this.#focusHalo);
      this.#focusHalo.geometry.dispose();
      (this.#focusHalo.material as THREE.Material).dispose();
      this.#focusHalo = null;
    }
    const path = layer !== null ? this.#geometry.layers[layer - 1] : undefined;
    if (path) {
      this.#focusHalo = new THREE.Mesh(
        this.#tubeAlong(path, 1, this.#geometry.beadRadius * 1.9).geometry,
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
        }),
      );
      this.#focusHalo.renderOrder = RENDER_ORDER + 1;
      this.root.add(this.#focusHalo);
    }
  }

  /**
   * The point of the part a ray meets first, and the dot on it; `null` (and no dot) for none.
   * `mark: false` finds the point without the dot, for a pointer over the part as a whole.
   */
  pick(
    raycaster: THREE.Raycaster,
    { mark = true }: { mark?: boolean } = {},
  ): PartPoint | null {
    // Not placed on the plate (yet): wherever its stale matrix puts it, it is not on screen.
    if (!this.root.visible) {
      this.#hoverMarker.visible = false;
      return null;
    }
    const meshes = [...this.#layers.values()]
      .map((entry) => entry.mesh)
      .filter((mesh) => mesh.visible);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    const entry = hit ? this.#layers.get(hit.object.userData.layer) : undefined;
    if (!hit?.face || !entry) {
      this.#hoverMarker.visible = false;
      return null;
    }
    this.#hoverMarker.position.copy(this.root.worldToLocal(hit.point.clone()));
    this.#hoverMarker.visible = mark;
    return {
      layer: hit.object.userData.layer,
      sample: this.#sampleAt(entry, hit.face.a),
    };
  }

  clearPick() {
    this.#hoverMarker.visible = false;
  }

  dispose() {
    this.root.removeFromParent();
    this.root.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry.dispose();
      }
    });
    this.#focusHalo?.geometry.dispose();
    this.#material.dispose();
    this.#ghostMaterial.dispose();
    (this.#hoverMarker.material as THREE.Material).dispose();
  }

  //----------------------------------------------------------------------------
  /** A tube along the first `drawn` (0–1) of a path. */
  #tubeAlong(path: readonly Point3[], drawn: number, radius: number) {
    const closed = this.#geometry.closed && drawn >= 1;
    let points = path.map((p) => new THREE.Vector3(...p));
    if (!closed) {
      points = cutAt(
        this.#geometry.closed ? [...points, points[0]] : points,
        drawn,
      );
    }
    const curve = new THREE.CatmullRomCurve3(points, closed, "centripetal");
    const tubularSegments = Math.max(
      4,
      Math.min(240, Math.round(curve.getLength() / 2)),
    );
    return {
      geometry: new THREE.TubeGeometry(
        curve,
        tubularSegments,
        radius,
        RADIAL_SEGMENTS,
        closed,
      ),
      tubularSegments,
    };
  }

  #buildLayer(record: LayerRecord) {
    const path = this.#geometry.layers[record.layer - 1];
    const old = this.#layers.get(record.layer);
    // Too short a stretch to draw yet.
    if (!path || record.progress < 0.005) {
      if (old) this.#removeLayer(record.layer, old);
      return;
    }
    const drawn = Math.min(1, record.progress);
    let mesh = old?.mesh;
    let tubularSegments = old?.tubularSegments ?? 0;
    // A complete layer keeps its tube; the one being laid grows.
    if (!old || old.drawn !== drawn) {
      const tube = this.#tubeAlong(path, drawn, this.#geometry.beadRadius);
      tubularSegments = tube.tubularSegments;
      const geometry = tube.geometry;
      geometry.setAttribute(
        "color",
        new THREE.BufferAttribute(
          new Float32Array(geometry.attributes.position.count * 3),
          3,
        ),
      );
      if (mesh) {
        mesh.geometry.dispose();
        mesh.geometry = geometry;
      } else {
        mesh = new THREE.Mesh(geometry, this.#material);
        mesh.userData.layer = record.layer;
        mesh.renderOrder = RENDER_ORDER;
        this.root.add(mesh);
      }
    }
    const entry: LayerMesh = {
      mesh: mesh!,
      version: record.version,
      drawn,
      tubularSegments,
    };
    this.#layers.set(record.layer, entry);
    this.#recolor(record, entry);
  }

  #removeLayer(layer: number, entry: LayerMesh) {
    this.root.remove(entry.mesh);
    entry.mesh.geometry.dispose();
    this.#layers.delete(layer);
  }

  /** The sample a vertex of a layer's tube lies on: its ring of vertices, along what is drawn. */
  #sampleAt(entry: LayerMesh, vertex: number) {
    const ring = Math.floor(vertex / (RADIAL_SEGMENTS + 1));
    const along =
      (Math.min(ring, entry.tubularSegments) / entry.tubularSegments) *
      entry.drawn;
    return Math.min(LAYER_SAMPLES - 1, Math.floor(along * LAYER_SAMPLES));
  }

  #recolor(record: LayerRecord, entry: LayerMesh) {
    const colors = entry.mesh.geometry.getAttribute(
      "color",
    ) as THREE.BufferAttribute;
    const cache = new Map<number, THREE.Color>();
    for (let v = 0; v < colors.count; v += 1) {
      const sample = this.#sampleAt(entry, v);
      let color = cache.get(sample);
      if (!color) {
        const rgb =
          metricColor(this.#metric, this.#theme, sampleValue(record, sample)) ??
          NEUTRAL_RGB;
        color = new THREE.Color().setRGB(
          rgb[0],
          rgb[1],
          rgb[2],
          THREE.SRGBColorSpace,
        );
        cache.set(sample, color);
      }
      colors.setXYZ(v, color.r, color.g, color.b);
    }
    colors.needsUpdate = true;
  }

  #recolorAll() {
    for (const [layer, entry] of this.#layers) {
      const record = this.#records[layer - 1];
      if (record) this.#recolor(record, entry);
    }
  }

  #applyVisibility() {
    for (const [layer, entry] of this.#layers) {
      entry.mesh.visible = layer <= this.#shownLayer;
    }
    this.#ghosts.forEach((ghost, index) => {
      const layer = index + 1;
      const record = this.#records[layer - 1];
      ghost.visible =
        this.#ghostOn &&
        (layer > this.#shownLayer || !record || record.progress < 1);
    });
  }
}

/** The first `fraction` of a polyline, by length, ending exactly there. */
function cutAt(points: THREE.Vector3[], fraction: number): THREE.Vector3[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) {
    lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
  }
  const target =
    Math.max(0, Math.min(1, fraction)) * lengths[lengths.length - 1];
  const out = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    if (lengths[i] < target) {
      out.push(points[i]);
      continue;
    }
    const span = lengths[i] - lengths[i - 1] || 1;
    out.push(
      points[i - 1].clone().lerp(points[i], (target - lengths[i - 1]) / span),
    );
    break;
  }
  // A curve needs two distinct points.
  if (out.length < 2) out.push(points[1].clone());
  return out;
}
