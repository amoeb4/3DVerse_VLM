import * as THREE from "three";

import type { JointAxis } from "../joints/joints";

//------------------------------------------------------------------------------
// Palette. Saturated enough to read on the light studio background as well as on a dark one: the
// overlay is alpha-blended over the streamed frame, so a pale glow would vanish on white.
//------------------------------------------------------------------------------
export const HOLO_COLOR = new THREE.Color("#1fc8ff");
export const HOLO_ACCENT = new THREE.Color("#2f6bff");

export const AXIS_COLORS: Record<JointAxis, THREE.Color> = {
  x: new THREE.Color("#ff4d5e"),
  y: new THREE.Color("#2fe38a"),
  z: new THREE.Color("#4f7dff"),
};

/**
 * Render order: occluders fill the depth buffer before anything visible is drawn. The joint glow
 * comes last, over everything, like light blooming in the lens.
 */
export const RENDER_ORDER = {
  occluder: -100,
  box: 10,
  lines: 20,
  gauge: 30,
  glow: 40,
} as const;

//------------------------------------------------------------------------------
/**
 * Writes depth only. Stands in for the mesh the server renders, which the browser has no depth for,
 * so whatever is behind it is hidden pixel by pixel. Pushed back a little so the hologram drawn on
 * the very same surface is not z-fought away.
 *
 * `doubleSided` for real meshes, whose faces are not all wound the same way.
 */
export function createOccluderMaterial({ doubleSided = false } = {}) {
  return new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: true,
    depthTest: true,
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 4,
  });
}

//------------------------------------------------------------------------------
const SHELL_VERTEX = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vLocalNormal;
  varying vec3 vWorld;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;

  void main() {
    vLocal = position;
    vLocalNormal = normal;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 view = viewMatrix * world;
    vViewPosition = view.xyz;
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * view;
  }
`;

const SHELL_FRAGMENT = /* glsl */ `
  #define TAU 6.28318530718

  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform vec3 uSize;        // box: its size; cylinder: (diameter, height, diameter). Scene units.
  uniform float uTime;
  uniform float uOpacity;
  uniform float uGrid;
  uniform float uScanPeriod;
  uniform float uReveal;     // 0 .. 1, the shell building up from its base

  varying vec3 vLocal;       // unit shape: box [-0.5, 0.5]³; cylinder radius 0.5, y in [-0.5, 0.5]
  varying vec3 vLocalNormal;
  varying vec3 vWorld;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;

  float gridLine(float coord, float spacing) {
    float c = coord / spacing;
    float d = abs(fract(c - 0.5) - 0.5) / fwidth(c);
    return 1.0 - min(d, 1.0);
  }

  float gridDot(vec2 coord, float spacing) {
    vec2 c = coord / spacing;
    vec2 d = abs(fract(c - 0.5) - 0.5) / fwidth(c);
    return 1.0 - smoothstep(0.8, 1.8, length(d));
  }

  void main() {
    // Build-up: nothing above the reveal front, a bright band on it.
    float height = vLocal.y + 0.5;
    if (height > uReveal + 0.001) discard;
    float front = uReveal < 1.0 ? 1.0 - smoothstep(0.0, 0.06, uReveal - height) : 0.0;

    vec2 metric;          // position on the surface, in scene units
    float edgeDistance;   // to the nearest outline, in scene units
#ifdef CYLINDER
    bool cap = abs(vLocalNormal.y) > 0.5;
    float radius = uSize.x * 0.5;
    if (cap) {
      float r = length(vLocal.xz) * uSize.x;
      metric = vec2(r, atan(vLocal.z, vLocal.x) * radius);
      edgeDistance = radius - r;
    } else {
      metric = vec2(atan(vLocal.z, vLocal.x) * radius, vLocal.y * uSize.y);
      edgeDistance = (0.5 - abs(vLocal.y)) * uSize.y;
    }
#else
    vec3 n = abs(vLocalNormal);
    vec2 inPlane = n.x > 0.5 ? vLocal.yz : (n.y > 0.5 ? vLocal.xz : vLocal.xy);
    vec2 size = n.x > 0.5 ? uSize.yz : (n.y > 0.5 ? uSize.xz : uSize.xy);
    metric = inPlane * size;
    vec2 toEdge = (0.5 - abs(inPlane)) * size;
    edgeDistance = min(toEdge.x, toEdge.y);
#endif

    float edgeHalo = 1.0 - smoothstep(0.0, fwidth(edgeDistance) * 14.0, edgeDistance);

    // Blueprint grid, with brighter nodes where its lines cross.
    float grid = max(gridLine(metric.x, uGrid), gridLine(metric.y, uGrid));
    float nodes = gridDot(metric, uGrid);

    // Scanlines sweeping up through the world, and a faint fine raster.
    float scanPhase = fract((vWorld.y - uTime * uScanPeriod * 0.35) / uScanPeriod);
    float scan = smoothstep(0.0, 0.04, scanPhase) * (1.0 - smoothstep(0.04, 0.22, scanPhase));
    float raster = 0.5 + 0.5 * sin(gl_FragCoord.y * 1.6);

    // Brighter where the surface turns away from the viewer.
    vec3 viewDir = normalize(-vViewPosition);
    float fresnel = pow(1.0 - abs(dot(normalize(vViewNormal), viewDir)), 2.0);

    float alpha = 0.025
      + 0.12 * fresnel
      + 0.08 * grid
      + 0.35 * nodes
      + 0.16 * edgeHalo
      + 0.22 * scan
      + 0.03 * raster
      + 0.8 * front;
    vec3 color = mix(uAccent, uColor, clamp(edgeHalo + scan + fresnel + nodes + front, 0.0, 1.0));
    color = mix(color, vec3(1.0), front * 0.6);

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0) * uOpacity);
  }
`;

/**
 * The hologram drawn on a part's shell: a box or, with `cylinder`, a cylinder along the unit
 * cylinder's y. `uSize` is the shell's size in scene units. Its outline is drawn by `GlowLines`.
 */
export function createShellMaterial({ cylinder = false } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: SHELL_VERTEX,
    fragmentShader: SHELL_FRAGMENT,
    defines: cylinder ? { CYLINDER: "" } : {},
    uniforms: {
      uColor: { value: HOLO_COLOR.clone() },
      uAccent: { value: HOLO_ACCENT.clone() },
      uSize: { value: new THREE.Vector3(1, 1, 1) },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uGrid: { value: 0.05 },
      uScanPeriod: { value: 0.6 },
      uReveal: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
  });
}

//------------------------------------------------------------------------------
const MESH_SHELL_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform vec3 uScale;       // the part's world scale: its own units to scene units, per axis
  uniform vec3 uBoxMin;      // the mesh's bounds, in the part's own space
  uniform vec3 uBoxMax;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uGrid;
  uniform float uScanPeriod;
  uniform float uReveal;     // 0 .. 1, the mesh scanned in along the part's own y

  varying vec3 vLocal;
  varying vec3 vLocalNormal;
  varying vec3 vWorld;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;

  float gridLine(float coord, float spacing) {
    float c = coord / spacing;
    float d = abs(fract(c - 0.5) - 0.5) / fwidth(c);
    return 1.0 - min(d, 1.0);
  }

  void main() {
    // Scan-in: nothing above the front, a bright band on it.
    float height = (vLocal.y - uBoxMin.y) / max(uBoxMax.y - uBoxMin.y, 1e-6);
    if (height > uReveal + 0.001) discard;
    float front = uReveal < 1.0 ? 1.0 - smoothstep(0.0, 0.035, uReveal - height) : 0.0;

    // Blueprint grid on the part, projected along the face's main axis: it turns with the part.
    vec3 metric = vLocal * uScale;
    vec3 n = abs(vLocalNormal);
    vec2 inPlane = n.x > n.y && n.x > n.z ? metric.yz : (n.y > n.z ? metric.xz : metric.xy);
    float grid = max(gridLine(inPlane.x, uGrid), gridLine(inPlane.y, uGrid));

    // Scanlines sweeping up through the world, and a faint fine raster.
    float scanPhase = fract((vWorld.y - uTime * uScanPeriod * 0.35) / uScanPeriod);
    float scan = smoothstep(0.0, 0.04, scanPhase) * (1.0 - smoothstep(0.04, 0.22, scanPhase));
    float raster = 0.5 + 0.5 * sin(gl_FragCoord.y * 1.6);

    // The silhouette glows: brighter where the surface turns away from the viewer.
    vec3 viewDir = normalize(-vViewPosition);
    float facing = abs(dot(normalize(vViewNormal), viewDir));
    float fresnel = pow(1.0 - facing, 2.0);

    float alpha = 0.06
      + 0.6 * fresnel
      + 0.06 * grid
      + 0.2 * scan
      + 0.025 * raster
      + 0.85 * front;
    vec3 color = mix(uAccent, uColor, clamp(0.35 + fresnel * 1.5 + scan + front, 0.0, 1.0));
    color = mix(color, vec3(1.0), front * 0.6);

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0) * uOpacity);
  }
`;

/**
 * The hologram drawn on a part's real mesh, in the part's own space. `uBoxMin` / `uBoxMax` are the
 * mesh's bounds there, which the scan-in runs across; its feature edges are drawn by `GlowLines`.
 */
export function createMeshShellMaterial(bounds: THREE.Box3) {
  return new THREE.ShaderMaterial({
    vertexShader: SHELL_VERTEX,
    fragmentShader: MESH_SHELL_FRAGMENT,
    uniforms: {
      uColor: { value: HOLO_COLOR.clone() },
      uAccent: { value: HOLO_ACCENT.clone() },
      uScale: { value: new THREE.Vector3(1, 1, 1) },
      uBoxMin: { value: bounds.min.clone() },
      uBoxMax: { value: bounds.max.clone() },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uGrid: { value: 0.05 },
      uScanPeriod: { value: 0.6 },
      uReveal: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    // Faces are not all wound the same way; the double-sided occluder hides the far ones.
    side: THREE.DoubleSide,
  });
}

//------------------------------------------------------------------------------
const PLANE_VERTEX = /* glsl */ `
  varying vec2 vPlane;
  void main() {
    vPlane = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GAUGE_FRAGMENT = /* glsl */ `
  #define PI 3.14159265359
  #define TAU 6.28318530718

  uniform vec3 uColor;
  uniform vec3 uHolo;
  uniform float uAngle;     // radians, signed
  uniform float uTime;
  uniform float uOpacity;

  varying vec2 vPlane;      // [-1, 1]², +x is 0°, +y is +90° about the joint axis

  float band(float r, float inner, float outer) {
    float w = fwidth(r);
    return smoothstep(inner - w, inner + w, r) * (1.0 - smoothstep(outer - w, outer + w, r));
  }

  // 1 inside the arc running from 0 to 'to' (either sign), 0 outside.
  float inArc(float theta, float to) {
    float t = to >= 0.0 ? theta : -theta;
    t = mod(t, TAU);
    float a = abs(to);
    float w = fwidth(theta) * 1.5;
    return a >= TAU - 0.001 ? 1.0 : 1.0 - smoothstep(a - w, a + w, t);
  }

  void main() {
    float r = length(vPlane);
    if (r > 1.0) discard;
    float theta = atan(vPlane.y, vPlane.x);
    float deg = mod(degrees(theta), 360.0);

    // Tick bezel: every 5°, longer every 30°.
    float tickPhase = abs(fract(deg / 5.0 + 0.5) - 0.5) * 5.0;  // degrees to the nearest tick
    float tickWidth = fwidth(deg) * 0.9;
    float tick = 1.0 - smoothstep(tickWidth * 0.5, tickWidth, tickPhase);
    float majorPhase = abs(fract(deg / 30.0 + 0.5) - 0.5) * 30.0;
    float major = 1.0 - smoothstep(tickWidth * 0.7, tickWidth * 1.4, majorPhase);
    float bezel = tick * band(r, 0.9, 0.97) * 0.55 + major * band(r, 0.84, 0.99);

    // Track and live arc.
    float track = band(r, 0.795, 0.805) * 0.5;
    float arc = inArc(theta, uAngle) * band(r, 0.76, 0.84);
    float arcGlow = inArc(theta, uAngle) * band(r, 0.70, 0.90) * 0.25;

    // Needle at the current angle.
    vec2 needleDir = vec2(cos(uAngle), sin(uAngle));
    float along = dot(vPlane, needleDir);
    float across = abs(dot(vPlane, vec2(-needleDir.y, needleDir.x)));
    float needle = step(0.0, along) * band(along, 0.5, 1.0)
      * (1.0 - smoothstep(0.0, fwidth(across) * 1.5, across));

    // Zero notch.
    float notch = (1.0 - smoothstep(0.0, 0.06, abs(vPlane.y))) * band(r, 0.97, 1.0) * step(0.0, vPlane.x);

    // Inner dashed ring, turning slowly — the "live" cue.
    float spin = theta + uTime * 0.25;
    float dashes = step(0.5, fract(spin * 24.0 / TAU));
    float inner = dashes * band(r, 0.6, 0.625) * 0.6;

    // Faint disc, so the gauge reads against a busy model.
    float disc = smoothstep(0.2, 0.95, r) * 0.10;

    float holo = bezel + track + inner + disc;
    float accent = arc + arcGlow + needle + notch;
    vec3 color = mix(uHolo, uColor, clamp(accent, 0.0, 1.0));
    float alpha = clamp(holo + accent, 0.0, 1.0);

    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`;

/** A joint gauge, drawn procedurally on a 2×2 plane laid in the joint's plane of rotation. */
export function createGaugeMaterial(axis: JointAxis) {
  return new THREE.ShaderMaterial({
    vertexShader: PLANE_VERTEX,
    fragmentShader: GAUGE_FRAGMENT,
    uniforms: {
      uColor: { value: AXIS_COLORS[axis].clone() },
      uHolo: { value: HOLO_COLOR.clone() },
      uAngle: { value: 0 },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });
}
