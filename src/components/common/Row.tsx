import { cn } from "@3dverse/ui-lib";

//------------------------------------------------------------------------------
/** A label and its value on one line (`horizontal`, the value at the end) or stacked (`vertical`). */
export function Row({
  label,
  value,
  orientation = "horizontal",
}: {
  label: string;
  value: React.ReactNode;
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <div
      className={cn(
        "flex gap-x-3 text-3xs",
        orientation === "horizontal"
          ? "justify-between *:data-[slot=value]:text-right"
          : "flex-col",
      )}
    >
      <span className="font-light text-secondary">{label}</span>
      <span data-slot="value" className="tabular-nums text-4xs">
        {value}
      </span>
    </div>
  );
}
