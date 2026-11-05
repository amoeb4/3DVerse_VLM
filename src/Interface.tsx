import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  type ChangeEvent,
} from "react";
import TorchExample from "./torch";
import { PartEntitiesContext } from "./partEntitiesContext";
import { LivelinkContext, useEntity } from "@3dverse/livelink-react";
import { setOrientation } from "./movements";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { Button, cn, Icon, Panel } from "@3dverse/ui-lib";

type SpeedContextType = {
  delayMs: number;
  setDelayMs: (value: number) => void;
  speed: number;
};

export const SpeedContext = createContext<SpeedContextType | undefined>(
  undefined,
);

export const SpeedProvider = ({ children }: { children: ReactNode }) => {
  const [delayMs, setDelayMs] = useState(100);
  const speed = 10000 / delayMs;
  return (
    <SpeedContext.Provider value={{ delayMs, setDelayMs, speed }}>
      {children}
    </SpeedContext.Provider>
  );
};

export function useSpeed() {
  const context = useContext(SpeedContext);
  if (!context) throw new Error("useSpeed must be used within a SpeedProvider");
  return context;
}

type EntityX = { id: string; name?: string };
type EntityContextType = {
  selectedEntity: EntityX | null;
  setSelectedEntity: (entity: EntityX) => void;
};

const EntityContext = createContext<EntityContextType | undefined>(undefined);

export const useEntitySimple = () => {
  const context = useContext(EntityContext);
  if (!context)
    throw new Error("useEntity must be used within an EntityProvider");
  return context;
};

export const EntityProvider = ({ children }: { children: ReactNode }) => {
  const [selectedEntity, setSelectedEntity] = useState<EntityX | null>(null);
  return (
    <EntityContext.Provider value={{ selectedEntity, setSelectedEntity }}>
      {children}
    </EntityContext.Provider>
  );
};

export default function ControlPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { entity: obj } = useEntity(
    { euid: "7ee8e052-e8bd-4ed4-ba90-6b31b9072d5b" },
    ["material"],
  );
  const { selectedEntity } = useEntitySimple();
  const { instance } = useContext(LivelinkContext);

  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });

  const { delayMs, setDelayMs } = useSpeed();

  const handleThresholdChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (obj?.material) {
      (obj.material.dataJSON.threshold as number) = value;
    }
  };

  const handleSliderChange =
    (axis: "x" | "y" | "z") => (e: ChangeEvent<HTMLInputElement>) => {
      const newAngle = parseFloat(e.target.value);
      const delta = newAngle - rotation[axis];
      setRotation((prev) => ({ ...prev, [axis]: newAngle }));
      if (instance && selectedEntity?.id) {
        setOrientation(instance, selectedEntity.id, axis, delta);
      }
    };

  return (
    <Panel
      className={cn(
        "fixed top-15 right-4 z-50 divide-y divide-tertiary w-[90vw] max-w-150 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.1)]",
        "origin-top-right transition-[opacity,translate,scale,visibility] duration-300 ease-out motion-reduce:transition-none",
        isOpen
          ? "opacity-100 translate-x-0 scale-100 visible"
          : "opacity-0 translate-x-4 scale-95 invisible",
      )}
    >
      <header className="flex justify-between items-center px-4 py-2">
        <h1 className="font-heading text-sm font-bold">Control Panel</h1>
        <Button variant="ghost" size="icon-xs" onClick={onClose}>
          <Icon className="fas fa-close" />
        </Button>
      </header>

      <div className="flex flex-wrap gap-2 px-3 py-2">
        <EntityDropdown />
        <Button variant="outline" size="sm" className="border-secondary">
          Mount Fronius torch
        </Button>
        <Button variant="outline" size="sm" className="border-secondary">
          Mount Spindle motor
        </Button>
        <Button variant="destructive" size="sm" className="border-secondary">
          Back to start
        </Button>
      </div>

      <div className="px-4 py-3 space-y-1">
        <Slider
          label="Delay"
          unit="ms"
          value={delayMs}
          min={5}
          max={200}
          step={1}
          onChange={(e) => setDelayMs(parseInt(e.target.value, 10))}
          color="accent"
        />

        {obj?.material && (
          <Slider
            label="Threshold"
            unit="°"
            value={(obj.material.dataJSON.threshold as number) ?? 0}
            min={-1.8}
            max={10}
            step={0.1}
            onChange={handleThresholdChange}
            color="neutral"
          />
        )}

        <Slider
          label="Rotation X"
          value={rotation.x}
          unit="°"
          min={-180}
          max={180}
          onChange={handleSliderChange("x")}
          color="axis-x"
        />
        <Slider
          label="Rotation Y"
          unit="°"
          value={rotation.y}
          min={-180}
          max={180}
          onChange={handleSliderChange("y")}
          color="axis-y"
        />
        <Slider
          label="Rotation Z"
          unit="°"
          value={rotation.z}
          min={-180}
          max={180}
          onChange={handleSliderChange("z")}
          color="axis-z"
        />
      </div>
      <div className="flex justify-end px-4 py-3">
        <TorchExample />
      </div>
    </Panel>
  );
}

// ---------------------- Slider ----------------------
function Slider({
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  onChange,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
  onChange: (e: any) => void;
  color: "accent" | "neutral" | "axis-x" | "axis-y" | "axis-z";
}) {
  // Design-token colors (`accent-*` sets the range input's CSS accent-color).
  const colorClasses: Record<typeof color, string> = {
    accent: "accent-accent",
    neutral: "accent-neutral-0",
    "axis-x": "accent-axis-x",
    "axis-y": "accent-axis-y",
    "axis-z": "accent-axis-z",
  };

  return (
    <div className="flex justify-between gap-2 w-full max-w-xl">
      <label className="basis-1/3 text-xs">{label}</label>
      <span className="basis-20 text-right text-2xs tabular-nums">
        {value}
        {unit && <span className="opacity-75">{unit}</span>}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className={`h-2 w-full rounded-lg appearance-none cursor-pointer ${colorClasses[color]} bg-neutral-900/20 border border-tertiary`}
      />
    </div>
  );
}

// ---------------------- Entity Dropdown ----------------------
export function EntityDropdown() {
  const { selectedEntity, setSelectedEntity } = useEntitySimple();
  const { entities: partEntities } = useContext(PartEntitiesContext);
  const [entities, setEntities] = useState<EntityX[]>([]);

  useEffect(() => {
    if (partEntities.length === 0) return;

    console.log(
      `🔍 EntityDropdown: ${partEntities.length} entités récupérées depuis PartEntitiesContext`,
    );

    const entitiesWithNames = partEntities
      .filter((e) => /^part_\d+$/.test(e.name ?? ""))
      .map((e) => {
        return { id: e.id, name: e.name || "(sans nom)" };
      })
      .sort(
        (a, b) =>
          parseInt(a.name!.split("_")[1], 10) -
          parseInt(b.name!.split("_")[1], 10),
      );

    setEntities(entitiesWithNames);
  }, [partEntities]);

  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <MenuButton className="inline-flex w-full justify-center items-center gap-x-1.5 rounded-md bg-overground px-2 py-px text-sm border border-tertiary hover:bg-primary/10">
          {selectedEntity?.name || "Entities"}
          <Icon className="fas fa-angle-down text-5xs opacity-60" />
        </MenuButton>
      </div>
      <MenuItems className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-overground shadow-lg border border-tertiary focus:outline-hidden">
        <div className="py-1">
          {entities.map((entity) => (
            <MenuItem key={entity.id}>
              {({ active }) => (
                <button
                  onClick={() => setSelectedEntity(entity)}
                  className={`${
                    active ? "bg-primary/10 text-primary" : "text-secondary"
                  } block w-full text-left px-4 py-2 text-sm`}
                >
                  {entity.name}
                </button>
              )}
            </MenuItem>
          ))}
        </div>
      </MenuItems>
    </Menu>
  );
}
