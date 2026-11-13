import { cn } from "@3dverse/ui-lib";

/**
 * A small line chart of the last `length` values, newest on the right, on a fixed scale. `NaN`
 * values leave a gap (e.g. while the arc is off). `band` shades a range, such as the window a
 * signal should stay in. The line takes the text colour: set it with `className`.
 */
export function Sparkline({
  values,
  length,
  min,
  max,
  band,
  label,
  emptyText = "No data yet",
  className,
}: {
  values: readonly number[];
  length: number;
  min: number;
  max: number;
  band?: readonly [number, number];
  label: string;
  emptyText?: string;
  className?: string;
}) {
  if (values.filter((value) => !Number.isNaN(value)).length < 2) {
    return (
      <div
        className={cn(
          "grid rounded border border-dashed border-tertiary [align-items:center] px-1 text-4xs text-tertiary/50!",
          className,
        )}
      >
        {emptyText}
      </div>
    );
  }

  const span = max - min;
  const y = (value: number) =>
    Math.min(100, Math.max(0, 100 - ((value - min) / span) * 100));
  // Right-aligned, so a history that is still filling up grows from the right like a full one.
  const offset = length - values.length;
  const x = (index: number) => ((offset + index) / (length - 1)) * 100;

  const segments: string[] = [];
  let current: string[] = [];
  values.forEach((value, index) => {
    if (Number.isNaN(value)) {
      if (current.length > 0) segments.push(current.join(" "));
      current = [];
      return;
    }
    current.push(`${x(index).toFixed(2)},${y(value).toFixed(2)}`);
  });
  if (current.length > 0) segments.push(current.join(" "));

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn("w-full rounded border border-tertiary", className)}
      role="img"
      aria-label={label}
    >
      {band && (
        <rect
          x="0"
          width="100"
          y={y(band[1])}
          height={Math.max(0, y(band[0]) - y(band[1]))}
          className="fill-positive opacity-10"
        />
      )}
      {segments.map((points, index) =>
        points.includes(" ") ? (
          <polyline
            key={index}
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ) : null,
      )}
    </svg>
  );
}
