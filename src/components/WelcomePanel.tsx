import { useState } from "react";
import { BottomSheet, BottomSheetContent, Button, cn } from "@3dverse/ui-lib";

import { MACHINES } from "../config";
import { useProcessFeed } from "../live/processFeed";
import type { ViewerScene } from "../routing";
import { SourceBadge } from "./common/SourceBadge";
import { MACHINE_STATUS } from "./startup/machineStatus";

const formatTime = (at: number) =>
  new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

/**
 * Whether to offer full screen: on a phone or a small tablet, in a browser tab (not installed to
 * the home screen), where the browser can do it at all. An iPhone's Safari cannot.
 */
function canOfferFullscreen() {
  return (
    document.fullscreenEnabled &&
    !document.fullscreenElement &&
    window.matchMedia("(pointer: coarse) and (max-width: 1023px)").matches &&
    !window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)")
      .matches
  );
}

/**
 * On a phone, as a machine opens: a sheet naming the machine, with what it is and what it is
 * building, and offering the viewer in full screen, where the browser's bars leave their room to
 * the 3D view. A browser only goes full screen from a tap, hence the button. Swiped away or
 * "Dismiss": the viewer as it is, in the tab.
 */
export function WelcomePanel({ scene }: { scene: ViewerScene }) {
  const [open, setOpen] = useState(canOfferFullscreen);
  // None for a scene opened by its UUID.
  const machine = MACHINES.find(({ sceneId }) => sceneId === scene.sceneId);

  const goFullscreen = () => {
    setOpen(false);
    // Refused (a browser setting, an embedding page): the viewer stays in the tab.
    document.documentElement
      .requestFullscreen({ navigationUI: "hide" })
      .catch(() => {});
  };

  return (
    <BottomSheet open={open} onOpenChange={setOpen}>
      <BottomSheetContent className="sm:max-w-xl text-balance">
        <div className="flex flex-col items-center gap-2 px-2 pt-6 pb-1 text-center">
          <h2 className="mt-1 font-orbitron text-2xl font-bold">
            {scene.name}
          </h2>
          {machine?.description && (
            <p className="max-w-xs text-xs">{machine.description}</p>
          )}
          <MachineFacts status={machine?.status} />
          <p className="max-w-xs text-xs text-secondary">
            The viewer takes the whole screen, without the browser&apos;s bars.
          </p>
          <Button
            variant="accent"
            size="xl"
            className="w-full mt-4 text-white!"
            onClick={goFullscreen}
          >
            Continue
          </Button>
          <Button
            variant="ghost"
            size="md"
            className="text-secondary"
            onClick={() => setOpen(false)}
          >
            Dismiss
          </Button>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}

/**
 * Where the machine stands: its status, and the job it is on (`ProductionStrip`'s, in short).
 * Apart, so the process is only read while the sheet is open.
 */
function MachineFacts({ status }: { status?: keyof typeof MACHINE_STATUS }) {
  const { source, job } = useProcessFeed(1000);
  const facts: [label: string, value: string][] = [
    ["Part", job.part],
    ["Layer", `${job.layer}/${job.layers}`],
    ["ETA", job.eta !== null ? formatTime(job.eta) : "on hold"],
  ];

  return (
    <div className="flex flex-col items-center gap-3 w-full mt-2 mb-1">
      {status && (
        <span
          className={cn(
            "inline-flex items-center h-6 px-2 rounded-full border text-3xs font-medium",
            MACHINE_STATUS[status].className,
          )}
        >
          {MACHINE_STATUS[status].label}
        </span>
      )}
      <dl className="relative grid grid-cols-3 w-full py-2.5 rounded-xl border border-tertiary divide-x divide-tertiary">
        {facts.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5 px-2">
            <dt className="text-3xs text-secondary">{label}</dt>
            <dd className="text-sm font-bold tabular-nums">{value}</dd>
          </div>
        ))}
        <SourceBadge
          source={source}
          className="absolute -top-2 right-3 bg-ground"
        />
      </dl>
    </div>
  );
}
