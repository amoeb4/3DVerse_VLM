import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  type ChangeEvent,
} from "react";
import TorchExample from "./TorchExample";
import { PartEntitiesContext } from "../partEntitiesContext";
import { LivelinkContext, useEntity } from "@3dverse/livelink-react";
import { setOrientation } from "../movements";
import {
  Button,
  cn,
  Icon,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  PanelHeader,
} from "@3dverse/ui-lib";
import { Panel, PanelTitle } from "./common";

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

export default function TrainingPanel({ className }: { className?: string }) {
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
      variant="glass"
      className={cn(
        "divide-y divide-tertiary",
        "origin-top-left transition-[opacity,translate,scale,visibility] duration-300 ease-out motion-reduce:transition-none",
        "starting:opacity-0 starting:-translate-x-4 starting:scale-95 starting:invisible",
        className,
      )}
    >
      <PanelHeader className="flex justify-between items-center">
        <PanelTitle>Training Panel</PanelTitle>
        <Button variant="destructive" size="xs">
          Back to start
        </Button>
      </PanelHeader>

      <div className="flex flex-wrap gap-2 px-3 py-2">
        <EntityDropdown />
        <Button variant="outline" size="xs">
          Mount Fronius torch
        </Button>
        <Button variant="outline" size="xs">
          Mount Spindle motor
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
    <Menu>
      <MenuTrigger render={<Button variant="outline" size="xs" />}>
        {selectedEntity?.name || "Entities"}
        <Icon className="fas fa-angle-down text-5xs opacity-60" />
      </MenuTrigger>
      <MenuContent className="w-56 max-h-80 overflow-y-auto border border-tertiary">
        {entities.map((entity) => (
          <MenuItem key={entity.id} onClick={() => setSelectedEntity(entity)}>
            {entity.name}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
