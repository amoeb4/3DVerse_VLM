"use client";
import { useContext, useEffect, useState, useRef } from "react";
import { LivelinkContext, useEntity } from "@3dverse/livelink-react";
import { Button, cn, Panel, Slider } from "@3dverse/ui-lib";

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
) => {
  await instance.scene.newEntity({
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
  });
};

const MAX_CONCURRENT_CREATES = 5;

const SAMPLE_INTERVAL_MS = 32;

const MIN_MOVE_DISTANCE = 0.008;

export function EntityCreator() {
  const { instance } = useContext(LivelinkContext);

  const [temperature, setTemperature] = useState<number>(50);
  const [latency, setLatency] = useState(0);
  const [autoWeld, setAutoWeld] = useState(false);
  const { entity: torch, isPending: isTorchPending } = useEntity({
    euid: "3951d6d3-bd81-43ff-96b2-0356d0bc7912",
  });
  const isTorchMissing = !isTorchPending && !torch;
  const { entity: plateau } = useEntity({
    euid: "19a0b434-94d5-4546-8e8a-7b894148c504",
  });

  const lastPosition = useRef<[number, number, number] | null>(null);
  const temperatureRef = useRef(temperature);
  useEffect(() => {
    temperatureRef.current = temperature;
  }, [temperature]);
  const queue = useRef<[number, number, number][]>([]);
  const inFlight = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setLatency(instance?.latency || 0);
    }, 33);

    return () => clearInterval(timer);
  }, [instance]);

  const distance = (a: number[], b: number[]) => {
    return Math.sqrt(
      (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2,
    );
  };

  useEffect(() => {
    if (!autoWeld || !torch) return;

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
  }, [autoWeld, torch]);
  useEffect(() => {
    if (!autoWeld || !instance) return;

    let active = true;

    const drain = () => {
      if (!active) return;

      while (
        queue.current.length &&
        inFlight.current < MAX_CONCURRENT_CREATES
      ) {
        const pos = queue.current.shift()!;
        inFlight.current++;

        createEntity(instance, pos, temperatureRef.current)
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
  }, [autoWeld, instance]);
  useEffect(() => {
    if (!autoWeld) {
      queue.current = [];
      lastPosition.current = null;
    }
  }, [autoWeld]);

  const handleCreate = async () => {
    if (!instance || !torch) return;

    const pos = torch.global_transform.position;

    await createEntity(instance, pos as [number, number, number], temperature);
  };

  return (
    <Panel
      className={cn(
        "absolute top-14 left-5 min-w-68 max-w-80 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.1)]",
        "starting:opacity-0 starting:-translate-y-8 transition-all duration-500",
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
            onValueChange={(value) => setTemperature(value)}
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
          onClick={() => setAutoWeld((v) => !v)}
          disabled={!instance || isTorchMissing}
          className="text-white! grow"
        >
          {autoWeld ? "Stop Weld" : "Start Weld"}
        </Button>
      </div>
    </Panel>
  );
}
