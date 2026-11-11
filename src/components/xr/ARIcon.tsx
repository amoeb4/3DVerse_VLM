import { cn } from "@3dverse/ui-lib";

//------------------------------------------------------------------------------
export const ARIcon = ({ className }: { className?: string }) => (
  <svg
    className={cn("w-48 h-48 text-primary", className)}
    width="100"
    height="100"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Ground plane */}
    <ellipse
      cx="50"
      cy="68"
      rx="36"
      ry="17"
      stroke="currentColor"
      strokeWidth="1.5"
      opacity={0.1}
      className="blur-xs"
    />

    {/* Ground-scan feature points */}
    <g fill="currentColor" opacity={0.45}>
      <circle cx="20" cy="62" r="1.6" />
      <circle cx="16" cy="72" r="1.6" />
      <circle cx="24" cy="80" r="1.6" />
      <circle cx="38" cy="84" r="1.6" />
      <circle cx="50" cy="85" r="1.6" />
      <circle cx="62" cy="84" r="1.6" />
      <circle cx="76" cy="80" r="1.6" />
      <circle cx="84" cy="72" r="1.6" />
      <circle cx="80" cy="62" r="1.6" />
      <circle cx="30" cy="70" r="1.6" />
      <circle cx="70" cy="70" r="1.6" />
      <circle cx="50" cy="76" r="1.6" />
    </g>

    {/* Isometric cube, hovering over the ground it is about to be placed on. */}
    <g
      stroke="currentColor"
      strokeLinejoin="round"
      strokeOpacity={0.9}
      className="animate-float motion-reduce:animate-none"
    >
      <path
        d="M50 26 L68 36 L50 46 L32 36 Z"
        fill="currentColor"
        fillOpacity={0.95}
      />
      <path
        d="M32 36 L50 46 L50 68 L32 58 Z"
        fill="currentColor"
        fillOpacity={0.55}
      />
      <path
        d="M68 36 L50 46 L50 68 L68 58 Z"
        fill="currentColor"
        fillOpacity={0.75}
      />
    </g>
  </svg>
);
