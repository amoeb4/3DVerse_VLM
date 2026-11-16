import nj130Image from "./assets/NJ130-2.05_1x.webp";
import type { AxisSpec } from "./preview/kinematics";
import nj40Image from "./assets/NJ40_1x.webp";

/**
 * The robot feed `WebSocketProvider` drives the arm from: the bridge to the real machine.
 * Overridden with `VITE_LIVE_FEED_URL` when the app is not running next to it.
 */
export const LIVE_FEED_URL =
  import.meta.env.VITE_LIVE_FEED_URL ?? "ws://localhost:8767";

/**
 * Variant Launch, which brings WebXR AR to iOS through an App Clip (`xr/xrSupport.ts`): its
 * project key, and its SDK. Without a key, AR stays unavailable on iPhones and iPads.
 * `VITE_VARIANT_API_KEY` overrides the project's key.
 */
export const VARIANT_API_KEY: string =
  import.meta.env.VITE_VARIANT_API_KEY || "hIMKeTkjMIJBrHeSy4JE1St6JX5INJ2o";
export const VARIANT_URL: string =
  import.meta.env.VITE_VARIANT_URL || "https://launchar.app/sdk/v1";

/**
 * The cell's two welding cameras, as image URLs (an MJPEG stream works), from the environment. Until
 * they are set, their tiles in Monitor say "not connected".
 */
export const CAMERA_FEEDS: { id: string; label: string; url?: string }[] = [
  { id: "arc", label: "Cam 1 · arc", url: import.meta.env.VITE_CAMERA_1_URL },
  {
    id: "pool",
    label: "Cam 2 · pool",
    url: import.meta.env.VITE_CAMERA_2_URL,
  },
];

/** The token every session in this app is opened with. */
export const PUBLIC_TOKEN = "public_ml59vXKlgs9fTJlx";

//------------------------------------------------------------------------------
/** Where a machine's digital twin stands, shown as a chip on its tile. */
export type MachineStatus = "operational" | "in-progress" | "deprecated";

export type Machine = {
  name: string;
  /**
   * The machine's address in the app: `/<slug>`, e.g. localhost:3005/nj130-2.05. Lowercase and
   * URL-safe. Keep it stable once shared: bookmarks and invite links point at it.
   */
  slug: string;
  sceneId: string;
  /** Short line under the name. */
  description?: string;
  /** Image from src/assets; tiles without one get a placeholder. */
  image?: string;
  status?: MachineStatus;
  /**
   * The entity the part is built on (its top face): where the Monitor and Part modes draw the part
   * in construction. Without one, the part is not shown in the cell.
   */
  buildPlate?: string;
  /**
   * How the robot moves, for Preview's playback of a part program (`preview/robotPreview.ts`).
   * Without it, Preview shows the program's path only.
   */
  kinematics?: RobotKinematics;
};

/**
 * A robot's axes as its scene draws them, for its inverse kinematics (`preview/kinematics.ts`).
 * Measured on the scenes (the joints' axes, the torch's wire, the positioner against the
 * programs): see each machine's comments.
 */
export type RobotKinematics = {
  /** `part_1` to `part_6`, then `part_7` (the cradle's tilt, `DD`) and `part_8` (the turntable, `FF`). */
  axes: readonly AxisSpec[];
  /**
   * The torch, in `part_6`'s frame and units: its TCP (the tool `SO_15`: 15 mm of wire out of
   * the contact tip) and its axis, the unit vector from the tip up to its body.
   */
  tool: {
    tcp: readonly [number, number, number];
    axis: readonly [number, number, number];
  };
  /**
   * The part's frame (`G54`): an entity carried by the positioner, and where on it (in its units)
   * the frame's origin stands, its axes the entity's.
   */
  workpiece: { euid: string; origin: readonly [number, number, number] };
};

//------------------------------------------------------------------------------
export const MACHINES: Machine[] = [
  {
    name: "NJ130 2.05",
    slug: "nj130-2.05",
    sceneId: "759ed8c4-fb60-432c-a41e-cf0f39f92d6f",
    description: "Welding cell · 6-axis arm on positioner and turntable",
    image: nj130Image,
    status: "operational",
    // "meshes[321]", the turntable's plate, under part_8.
    buildPlate: "19a0b434-94d5-4546-8e8a-7b894148c504",
    kinematics: {
      // The angle each axis turns is the bridge's (`orientationMap`, grpc_proxy.ts); 0 is the
      // scene's pose. The positioner's, those that keep the torch upright over the part all
      // through PB_1, PB_2 and PH_3.
      axes: [
        { index: 2, zero: [90, 0, 9.9635] },
        { index: 1, zero: [-86.4389, 72.9735, -86.8517] },
        { index: 2, zero: [-179.8066, -0.5444, 135.9979] },
        { index: 0, zero: [180, 0, 90] },
        { index: 2, zero: [-177.9989, 0.0105, 179.7737] },
        { index: 0, zero: [1.0001, 0.0001, -180] },
        { index: 1, zero: [180, 0, 0] },
        { index: 1, zero: [-180, 0, 180] },
      ],
      // From the Fronius torch's wire (its sub-scene's "nodes[44]"), in part_6's frame (mm).
      tool: {
        tcp: [-429.893, -347.759, 5.756],
        axis: [0.9997, 0.0164, -0.0168],
      },
      // The plate's own frame is G54: centred, its bottom face at z = 0 (the part's first layer is
      // at Z 20, the plate's thickness).
      workpiece: {
        euid: "19a0b434-94d5-4546-8e8a-7b894148c504",
        origin: [0, 0, 0],
      },
    },
  },
  {
    name: "NJ40",
    slug: "nj40",
    sceneId: "a1d7bb38-1a12-46fb-8485-36b29460cd2c",
    description: "Welding cell · 6-axis arm with tilting positioner",
    image: nj40Image,
    status: "in-progress",
    kinematics: {
      // Axes found on the scene's geometry: part_1 upright, part_2 and part_3 parallel, part_4
      // along the forearm, part_5 across it, part_6 along the flange. 0 is the scene's pose.
      axes: [
        { index: 2, zero: [-89.9998, -1.6017, 90] },
        { index: 2, zero: [-13.8006, -0.2992, -6.9955] },
        { index: 2, zero: [175.7933, -0.8499, 155.7628] },
        { index: 0, zero: [-0.0195, -89.8344, -0.0195] },
        { index: 2, zero: [0, 0, 0] },
        { index: 0, zero: [-5.0307, 0, 0] },
        { index: 1, zero: [90.7764, 0, -180] },
        { index: 2, zero: [0, -0.0044, -90] },
      ],
      // From the torch's wire ("meshes[195]"), in part_6's frame (mm).
      tool: { tcp: [-387.121, 340.661, 0.121], axis: [1, 0, 0] },
      // The turntable (part_8): its top face, at z = -12, centred.
      workpiece: {
        euid: "bca1e55e-0191-4011-a9be-b7aae005277a",
        origin: [0, 0, -12],
      },
    },
  },
  {
    name: "Comau racer 3",
    slug: "comau-racer-3",
    sceneId: "516d270a-5a6b-44e6-99c6-44df631bf475",
    description: "Compact 6-axis arm",
    status: "in-progress",
  },
  {
    name: "Test_primitive [deprecated]",
    slug: "test-primitive",
    sceneId: "ec33e19d-da9f-4593-8412-a9c0c32cc5ba",
    description: "Primitive test scene",
    status: "deprecated",
  },
];
