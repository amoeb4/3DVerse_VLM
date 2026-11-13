export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-3xs text-secondary">{label}</span>
      <span className="text-xs font-bold tabular-nums">{value}</span>
    </div>
  );
}
