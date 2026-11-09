import type { Entity } from "@3dverse/livelink";

export function EntityStatusPanel({
  hoveredEntity,
  pickedEntity,
}: {
  hoveredEntity: Entity | null;
  pickedEntity: Entity | null;
}) {
  return (
    <div className="flex flex-col gap-2 mt-3">
      <EntityPanel
        label="Hovered entity"
        color="bg-informative-500/50"
        entity={hoveredEntity}
      />
      <EntityPanel
        label="Picked entity"
        color="bg-positive-500/50"
        entity={pickedEntity}
      />
    </div>
  );
}

export function EntityPanel({
  label,
  entity,
  color,
}: {
  label: string;
  color: string;
  entity: Entity | null;
}) {
  return (
    <div className="text-3xs">
      <span className="bg-ground px-2 py-1 rounded-lg rounded-r-none">
        {label}
      </span>
      <span
        className={`px-2 py-1 rounded-lg rounded-l-none text-primary-dark font-medium ${entity ? color : "bg-negative-500/20"}`}
      >
        {entity ? entity.name : "none"}
      </span>
    </div>
  );
}
