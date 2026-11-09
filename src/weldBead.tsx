"use client";
import { useContext, useEffect, useState, useRef } from "react";
import { LivelinkContext, useEntity } from "@3dverse/livelink-react";
import type { Entity } from "@3dverse/livelink";
import { Button, cn, Panel, Slider } from "@3dverse/ui-lib";

import { logEvent } from "./live/eventLog";
import { recordWeld, setWelding, useIsWelding } from "./live/weldLog";
import { TORCH_EUID } from "./components/weld/torch";
import { useWritesWeld } from "./components/weld/useWritesWeld";

const MATERIAL_REFS = [
  "5a54e41e-164c-47f8-bf4b-c8d00c3b61aa",
  "561b317b-017f-410b-a04e-f925519dea62",
  "3a2488f6-aa20-4698-883a-6eb5693964f9",
  "cdcbac06-a458-4f35-b868-34ac8d57ddaa",
  "92548856-c45a-45b5-a9d5-45c77bc7660b",
  "63b13bc0-5491-414e-8980-ba67e32ff91f",
  "21514595-395d-45a7-9c20-2a12bc1b520c",
  "529dd88c-c943-41f0-88a7-b96419e1e8b8",
  "de9844ab-3c9e-4ce7-9e2b-dec91474d11d",
  "58ab98c3-25d3-4187-a407-24158f213996",
] as const;

export const getMaterialFromTemperature = (temp: number) => {
  const index = Math.min(MATERIAL_REFS.length - 1, Math.floor(temp / 10));
  return MATERIAL_REFS[index];
};

export const getScaleFromTemperature = (
  temp: number,
): [number, number, number] => {
  const t = temp / 100;
  const min = 0.002;
  const max = 0.006;
  const value = min + (max - min) * t;
  return [value, value * 2.5, value];
};

export const createEntity = async (
  instance: any,
  position: [number, number, number],
  temperature: number,
): Promise<Entity> => {
  const bead = await instance.scene.newEntity({
    name: "Weld Bead",
    components: {
      local_transform: {
        position,
        scale: getScaleFromTemperature(temperature),
      },
      mesh_ref: { value: "53daef4f-eef0-4b09-9815-50733891ed10" },
      material_ref: {
        value: getMaterialFromTemperature(temperature),
      },
    },
    // Gone with the viewer that laid it: the session keeps its edits, and a running machine lays
    // beads all day.
    options: { delete_on_client_disconnection: true },
  });
  recordWeld(temperature);
  return bead;
};

/** The temperature beads are laid at, 0–100: Training's slider sets it. */
let beadTemperature = 50;

const MAX_CONCURRENT_CREATES = 5;

const SAMPLE_INTERVAL_MS = 32;

const MIN_MOVE_DISTANCE = 0.008;

/** The beads a viewer keeps in the scene: past this, the oldest go as new ones are laid. */
const MAX_BEADS = 1500;

const distance = (a: number[], b: number[]) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

//------------------------------------------------------------------------------
/**
 * Lays the bead along the torch's path while the arc burns: a "Weld Bead" entity in the shared
 * scene every `MIN_MOVE_DISTANCE` the tip moves, the last `MAX_BEADS` kept. Only the viewer that
 * writes the weld lays them (`useWritesWeld`), so the session gets one bead, not one per viewer.
 *
 * In every mode, whether the weld was started by the machine (`AutoWeld`) or by Training's Start
 * Weld. Mount once, inside `Livelink`.
 */
export function WeldBeads() {
  const { instance } = useContext(LivelinkContext);
  const { entity: torch } = useEntity({ euid: TORCH_EUID });
  const isLaying = useWritesWeld();

  const lastPosition = useRef<[number, number, number] | null>(null);
  const queue = useRef<[number, number, number][]>([]);
  const inFlight = useRef(0);
  /** The beads this viewer laid, oldest first. */
  const laid = useRef<Entity[]>([]);

  // Where the tip has been, as it moves.
  useEffect(() => {
    if (!isLaying || !torch) return;

    const id = setInterval(() => {
      const pos = torch?.global_transform?.position as
        [number, number, number] | undefined;

      if (!pos) return;

      if (!lastPosition.current) {
        lastPosition.current = [...pos];
        return;
      }
      if (distance(pos, lastPosition.current) > MIN_MOVE_DISTANCE) {
        queue.current.push([...pos] as [number, number, number]);
        lastPosition.current = [...pos];
      }
    }, SAMPLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isLaying, torch]);

  // A bead on each, a few creations in flight at most.
  useEffect(() => {
    if (!isLaying || !instance) return;

    let active = true;

    const drain = () => {
      if (!active) return;

      while (
        queue.current.length &&
        inFlight.current < MAX_CONCURRENT_CREATES
      ) {
        const pos = queue.current.shift()!;
        inFlight.current++;

        createEntity(instance, pos, beadTemperature)
          .then((bead) => {
            laid.current.push(bead);
            const excess = laid.current.length - MAX_BEADS;
            if (excess > 0) {
              const oldest = laid.current.splice(0, excess);
              void instance.scene
                .deleteEntities({ entities: oldest })
                .catch((err: unknown) =>
                  console.error("Cannot remove old weld beads", err),
                );
            }
          })
          .catch((err) => console.error("createEntity failed", err))
          .finally(() => {
            inFlight.current--;
          });
      }
      requestAnimationFrame(drain);
    };

    const frame = requestAnimationFrame(drain);

    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [isLaying, instance]);

  // The arc off: the next weld starts from where the tip is then, not from where this one ended.
  useEffect(() => {
    if (!isLaying) {
      queue.current = [];
      lastPosition.current = null;
    }
  }, [isLaying]);

  return null;
}

//------------------------------------------------------------------------------
/** Training's weld demo: the bead's temperature, a single bead, and Start / Stop Weld. */
export function EntityCreator() {
  const { instance } = useContext(LivelinkContext);

  const [temperature, setTemperature] = useState<number>(() => beadTemperature);
  const [latency, setLatency] = useState(0);
  const welding = useIsWelding();
  const { entity: torch, isPending: isTorchPending } = useEntity({
    euid: TORCH_EUID,
  });
  const isTorchMissing = !isTorchPending && !torch;

  useEffect(() => {
    const timer = setInterval(() => {
      setLatency(instance?.latency || 0);
    }, 33);

    return () => clearInterval(timer);
  }, [instance]);

  const handleCreate = async () => {
    if (!instance || !torch) return;

    const pos = torch.global_transform.position;

    await createEntity(instance, pos as [number, number, number], temperature);
  };

  // By hand, until the machine next starts or ends a layer (`AutoWeld`). For the supervision panel.
  const toggleWeld = () => {
    setWelding(!welding);
    logEvent(
      "info",
      "weld",
      welding ? "Welding stopped" : `Welding started at ${temperature} °C`,
    );
  };

  return (
    <Panel
      className={cn(
        "backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.1)]",
        "origin-top-left transition-[opacity,translate,scale,visibility] duration-300 ease-out motion-reduce:transition-none",
        "starting:opacity-0 starting:-translate-x-4 starting:scale-95 starting:invisible",
      )}
    >
      <div className="flex flex-col gap-2 px-4 py-3 text-3xs">
        <div className="flex flex-col gap-0.5">
          <div className="flex justify-between">
            <label>Temperature</label>
            <p className="text-accent tabular-nums">{temperature}°C</p>
          </div>
          <Slider
            min={0}
            max={100}
            value={temperature}
            onValueChange={(value) => {
              setTemperature(value);
              beadTemperature = value;
            }}
            size="2xs"
            className="[&_output]:text-white"
          />
        </div>
        <div className="flex justify-between">
          <label>Latency</label>
          <p className="text-accent tabular-nums">{latency.toFixed(0)} ms</p>
        </div>
      </div>
      <div className="flex gap-2 px-4 py-3 border-t border-tertiary">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCreate}
          disabled={!instance || isTorchMissing}
        >
          Create Entity
        </Button>
        <Button
          variant="accent"
          size="sm"
          onClick={toggleWeld}
          disabled={!instance || isTorchMissing}
          className="text-white! grow"
        >
          {welding ? "Stop Weld" : "Start Weld"}
        </Button>
      </div>
    </Panel>
  );
}
