"use client";
import { useContext, useEffect, useState, useRef } from "react";
import { LivelinkContext, useEntity } from "@3dverse/livelink-react";

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
    const index = Math.min(
        MATERIAL_REFS.length - 1,
        Math.floor(temp / 10)
    );
    return MATERIAL_REFS[index];
};

export const getScaleFromTemperature = (temp: number): [number, number, number] => {
    const t = temp / 100;
    const min = 0.004;
    const max = 0.010;
    const value = min + (max - min) * t;

    return [value, value, value * 2];
};

export const createEntityOpt = async(
    instance: any
) =>{
    await instance.scene.newEntity({name : "newBead"});
    rotaRef: 

}

export const createEntity = async (
    instance: any,
    position: [number, number, number],
    temperature: number
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

export function EntityCreator() {
    const { instance } = useContext(LivelinkContext);

    const [temperature, setTemperature] = useState(50);
    const [latency, setLatency] = useState(0);
    const [autoWeld, setAutoWeld] = useState(false);

    const { entity: torch } = useEntity({
        euid: "3951d6d3-bd81-43ff-96b2-0356d0bc7912",
    });

    const lastPosition = useRef<[number, number, number] | null>(null);

    useEffect(() => {
        const timer = setInterval(() => {
            setLatency(instance?.latency || 0);
        }, 33);

        return () => clearInterval(timer);
    }, [instance]);

    const distance = (a: number[], b: number[]) => {
        return Math.sqrt(
            (a[0] - b[0]) ** 2 +
            (a[1] - b[1]) ** 2 +
            (a[2] - b[2]) ** 2
        );
    };

    useEffect(() => {
        if (!autoWeld || !instance || !torch) return;
        let active = true;
        const loop = async () => {
            while (active) {

                const pos = torch?.global_transform?.position;

                if (pos) {
                    if (!lastPosition.current) {
                        lastPosition.current = [...pos];
                    }
                    const moved =
                        distance(pos, lastPosition.current) > 0.001;
                    if (moved) {
                        await createEntity(
                            instance,
                            pos as [number, number, number],
                            temperature
                        );
                        lastPosition.current = [...pos];
                    }
                }
                await new Promise(r => setTimeout(r, 200));
            }
        };
        loop();
        return () => {
            active = false;
        };

    }, [autoWeld, instance, torch, temperature]);

    const handleCreate = async () => {

        if (!instance || !torch) return;

        const pos = torch.global_transform.position;

        await createEntity(
            instance,
            pos as [number, number, number],
            temperature
        );
    };

    return (
        <div className="absolute text-white top-32 left-5 flex flex-col gap-2 bg-black/30 p-3 rounded-xl">

            <button
                className="button button-overlay"
                onClick={handleCreate}
                disabled={!instance}>
                Create Entity
            </button>

            <button
                className="button button-overlay"
                onClick={() => setAutoWeld(v => !v)}
                disabled={!instance}>
                {autoWeld ? "Stop Weld" : "Start Weld"}
            </button>

            <label className="flex flex-col text-white text-sm">
                Température: {temperature}
                <br />
                Latency: {`${latency.toFixed(0)}ms`}

                <input
                    type="range"
                    min={0}
                    max={100}
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="w-40"
                />
            </label>

        </div>
    );
}