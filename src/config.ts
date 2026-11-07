import nj130Image from "./assets/NJ130-2.05_1x.webp";
import nj40Image from "./assets/NJ40_1x.webp";

/** The token every session in this app is opened with. */
export const PUBLIC_TOKEN = "public_ml59vXKlgs9fTJlx";

//------------------------------------------------------------------------------
/** Where a machine's digital twin stands, shown as a chip on its tile. */
export type MachineStatus = "operational" | "in-progress" | "deprecated";

/**
 * One step of a digital twin, from the bare 3D model to the full welding loop. The tile's
 * completion bar is the share of these that are done.
 */
export type Milestone = { label: string; done: boolean };

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
  /** Facts shown as small chips: axes, tooling, … */
  specs?: string[];
  milestones?: Milestone[];
};

//------------------------------------------------------------------------------
// Milestones as checked in each scene on 2026-11-05: `part_N` joints present (kinematics), a
// joint-angle mapping for the live feed (grpc_proxy.ts / tester_python/ws_bridge.py), and a torch
// entity wired to "Start Weld" (weldBead.tsx). Update them as the twins progress.
export const MACHINES: Machine[] = [
  {
    name: "NJ130 2.05",
    slug: "nj130-2.05",
    sceneId: "759ed8c4-fb60-432c-a41e-cf0f39f92d6f",
    description: "Welding cell · 6-axis arm on positioner and turntable",
    image: nj130Image,
    status: "operational",
    specs: ["8 axes", "Fronius torch", "Live data"],
    milestones: [
      { label: "3D model", done: true },
      { label: "Kinematics", done: true },
      { label: "Live data", done: true },
      { label: "Welding", done: true },
    ],
  },
  {
    name: "NJ40",
    slug: "nj40",
    sceneId: "a1d7bb38-1a12-46fb-8485-36b29460cd2c",
    description: "Welding cell · 6-axis arm with tilting positioner",
    image: nj40Image,
    status: "in-progress",
    specs: ["8 axes", "Fronius torch"],
    milestones: [
      { label: "3D model", done: true },
      { label: "Kinematics", done: true },
      { label: "Live data", done: false },
      { label: "Welding", done: false },
    ],
  },
  {
    name: "Comau racer 3",
    slug: "comau-racer-3",
    sceneId: "516d270a-5a6b-44e6-99c6-44df631bf475",
    description: "Compact 6-axis arm",
    status: "in-progress",
    specs: ["6 axes"],
    milestones: [
      { label: "3D model", done: true },
      { label: "Kinematics", done: false },
      { label: "Live data", done: false },
      { label: "Welding", done: false },
    ],
  },
  {
    name: "Test_primitive [deprecated]",
    slug: "test-primitive",
    sceneId: "ec33e19d-da9f-4593-8412-a9c0c32cc5ba",
    description: "Primitive test scene",
    status: "deprecated",
  },
];
