import type { Entity } from "@3dverse/livelink";

export function EntityStatusPanel({
  hoveredEntity,
  pickedEntity,
}: {
  hoveredEntity: Entity | null;
  pickedEntity: Entity | null;
}) {
  return (
    <div className="absolute flex flex-col gap-4 m-4">
      <EntityPanel
        label="Hovered entity"
        color="bg-informative-500"
        entity={hoveredEntity}
      />
      <EntityPanel
        label="Picked entity"
        color="bg-positive-500"
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
    <div>
      <span className="bg-ground px-3 py-2 rounded-lg rounded-r-none">
        {label}
      </span>
      <span
        className={`px-3 py-2 rounded-lg rounded-l-none text-primary-dark font-semibold ${entity ? color : "bg-negative-500"}`}
      >
        {entity ? entity.name : "none"}
      </span>
    </div>
  );
}
