import * as THREE from "three";

import { HOLO_COLOR, RENDER_ORDER } from "./holoMaterials";

/**
 * The overlay's size in pixels, shared by every glow line: their width is in pixels, so it has to
 * be known in clip space. Set once per frame by the stage.
 */
export const GLOW_RESOLUTION = { value: new THREE.Vector2(1, 1) };

const VERTEX = /* glsl */ `
  uniform vec2 uResolution;
  uniform float uWidth;

  attribute vec3 aEnd;
  attribute vec2 aCorner;   // x: 0 at the start, 1 at the end; y: -1 / +1 across

  // Pre-multiplied by w and divided back per fragment: interpolated linearly on screen, not in
  // depth, so the glow keeps its width along a line that recedes.
  varying vec3 vScreenW;    // (across in widths, along in px, segment length in px) * w
  varying float vW;

  void main() {
    vec4 a = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec4 b = projectionMatrix * modelViewMatrix * vec4(aEnd, 1.0);
    // Behind the camera: dropped rather than clipped, the camera is seldom inside the machine.
    if (a.w < 1e-4 || b.w < 1e-4) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      vScreenW = vec3(0.0);
      vW = 1.0;
      return;
    }

    vec2 halfRes = uResolution * 0.5;
    vec2 sa = a.xy / a.w * halfRes;
    vec2 sb = b.xy / b.w * halfRes;
    vec2 dir = sb - sa;
    float len = length(dir);
    dir = len > 1e-5 ? dir / len : vec2(1.0, 0.0);
    vec2 normal = vec2(-dir.y, dir.x);

    // Widened across, and lengthened at both ends so the glow rounds off past them.
    float along = aCorner.x * 2.0 - 1.0;
    vec2 offset = normal * aCorner.y * uWidth + dir * along * uWidth;
    vec4 p = aCorner.x < 0.5 ? a : b;
    p.xy += offset / halfRes * p.w;
    gl_Position = p;

    float alongPx = aCorner.x < 0.5 ? -uWidth : len + uWidth;
    vScreenW = vec3(aCorner.y, alongPx, len) * p.w;
    vW = p.w;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uWidth;
  uniform float uCore;      // the bright core's half-width, as a fraction of the glow's
  uniform float uGlow;

  varying vec3 vScreenW;
  varying float vW;

  void main() {
    vec3 screen = vScreenW / vW;
    float across = screen.x;
    // Past either end, in widths: the caps are half-discs.
    float past = max(-screen.y, screen.y - screen.z) / uWidth;
    float d = length(vec2(across, max(past, 0.0)));

    float core = 1.0 - smoothstep(uCore * 0.5, uCore, d);
    float glow = exp(-d * d * 5.0) * (1.0 - smoothstep(0.85, 1.0, d)) * uGlow;
    float alpha = clamp(core + glow, 0.0, 1.0) * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(mix(uColor, vec3(1.0), core * 0.55), alpha);
  }
`;

export type GlowLinesOptions = {
  color?: THREE.Color;
  /** Half-width of the glow, in pixels. */
  width?: number;
  opacity?: number;
  /** Half-width of the bright core, as a fraction of the glow's. */
  core?: number;
  /** Strength of the soft halo around the core. */
  glow?: number;
};

/**
 * Line segments drawn as soft, glowing strokes of constant width on screen: a bright core and a halo
 * that bleeds past the shape's outline. Depth-tested, so they are cut by the occluders like the rest
 * of the HUD.
 *
 * `segments` is a flat list of start and end points, six numbers per segment, in the object's own
 * space. `setSegment` moves one, for lines that follow something.
 */
export class GlowLines extends THREE.Mesh<
  THREE.BufferGeometry,
  THREE.ShaderMaterial
> {
  readonly #starts: THREE.BufferAttribute;
  readonly #ends: THREE.BufferAttribute;

  constructor(segments: ArrayLike<number>, options: GlowLinesOptions = {}) {
    const count = Math.floor(segments.length / 6);
    const starts = new Float32Array(count * 12);
    const ends = new Float32Array(count * 12);
    const corners = new Float32Array(count * 8);
    const indices: number[] = [];
    for (let i = 0; i < count; i++) {
      for (let v = 0; v < 4; v++) {
        corners.set([v >> 1, v & 1 ? 1 : -1], (i * 4 + v) * 2);
      }
      const base = i * 4;
      indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }

    const geometry = new THREE.BufferGeometry();
    const startAttribute = new THREE.BufferAttribute(starts, 3);
    const endAttribute = new THREE.BufferAttribute(ends, 3);
    geometry.setAttribute("position", startAttribute);
    geometry.setAttribute("aEnd", endAttribute);
    geometry.setAttribute("aCorner", new THREE.BufferAttribute(corners, 2));
    geometry.setIndex(indices);

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uResolution: GLOW_RESOLUTION,
        uColor: { value: (options.color ?? HOLO_COLOR).clone() },
        uWidth: { value: options.width ?? 6 },
        uOpacity: { value: options.opacity ?? 1 },
        uCore: { value: options.core ?? 0.18 },
        uGlow: { value: options.glow ?? 0.55 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });

    super(geometry, material);
    this.#starts = startAttribute;
    this.#ends = endAttribute;
    this.frustumCulled = false;
    this.renderOrder = RENDER_ORDER.lines;

    for (let i = 0; i < count; i++) {
      const o = i * 6;
      this.setSegment(
        i,
        segments[o],
        segments[o + 1],
        segments[o + 2],
        segments[o + 3],
        segments[o + 4],
        segments[o + 5],
      );
    }
  }

  get opacity() {
    return this.material.uniforms.uOpacity.value as number;
  }

  set opacity(value: number) {
    this.material.uniforms.uOpacity.value = value;
  }

  setSegment(
    index: number,
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
  ) {
    for (let v = 0; v < 4; v++) {
      this.#starts.setXYZ(index * 4 + v, ax, ay, az);
      this.#ends.setXYZ(index * 4 + v, bx, by, bz);
    }
    this.#starts.needsUpdate = true;
    this.#ends.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

//------------------------------------------------------------------------------
// Outlines of the unit shapes the shells are drawn on.
//------------------------------------------------------------------------------

/** The 12 edges of the unit box. */
export function boxEdges(half = 0.5): number[] {
  const out: number[] = [];
  const s = [-half, half];
  for (const a of s) {
    for (const b of s) {
      out.push(-half, a, b, half, a, b);
      out.push(a, -half, b, a, half, b);
      out.push(a, b, -half, a, b, half);
    }
  }
  return out;
}

/** Corner brackets of the unit box: three short strokes from each corner. */
export function boxBrackets(length = 0.16, half = 0.5): number[] {
  const out: number[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const corner = [sx * half, sy * half, sz * half];
        const signs = [sx, sy, sz];
        for (let axis = 0; axis < 3; axis++) {
          const end = [...corner];
          end[axis] -= signs[axis] * length;
          out.push(...corner, ...end);
        }
      }
    }
  }
  return out;
}

/** A circle of radius 0.5 in the unit cylinder's y = `y` plane, from `from` to `to` radians. */
function arc(y: number, from: number, to: number, steps: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    const a0 = from + ((to - from) * i) / steps;
    const a1 = from + ((to - from) * (i + 1)) / steps;
    out.push(
      Math.cos(a0) * 0.5,
      y,
      Math.sin(a0) * 0.5,
      Math.cos(a1) * 0.5,
      y,
      Math.sin(a1) * 0.5,
    );
  }
  return out;
}

/** The unit cylinder's two rims and four seams (along y, radius 0.5, height 1). */
export function cylinderEdges(steps = 64): number[] {
  const out = [
    ...arc(0.5, 0, Math.PI * 2, steps),
    ...arc(-0.5, 0, Math.PI * 2, steps),
  ];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const x = Math.cos(a) * 0.5;
    const z = Math.sin(a) * 0.5;
    out.push(x, -0.5, z, x, 0.5, z);
  }
  return out;
}

/** Brackets of the unit cylinder: short arcs on both rims, a quarter turn apart. */
export function cylinderBrackets(span = 0.35): number[] {
  const out: number[] = [];
  for (const y of [-0.5, 0.5]) {
    for (let i = 0; i < 4; i++) {
      const centre = (i * Math.PI) / 2;
      out.push(...arc(y, centre - span / 2, centre + span / 2, 6));
    }
  }
  return out;
}
