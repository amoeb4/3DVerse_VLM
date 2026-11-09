import nj130Image from "./assets/NJ130-2.05_1x.webp";
import nj40Image from "./assets/NJ40_1x.webp";

/**
 * The robot feed `WebSocketProvider` drives the arm from: the bridge to the real machine.
 * Overridden with `VITE_LIVE_FEED_URL` when the app is not running next to it.
 */
export const LIVE_FEED_URL =
  import.meta.env.VITE_LIVE_FEED_URL ?? "ws://localhost:8767";

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
  },
  {
    name: "NJ40",
    slug: "nj40",
    sceneId: "a1d7bb38-1a12-46fb-8485-36b29460cd2c",
    description: "Welding cell · 6-axis arm with tilting positioner",
    image: nj40Image,
    status: "in-progress",
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
