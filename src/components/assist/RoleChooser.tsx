import { cn, Icon } from "@3dverse/ui-lib";
import { Panel } from "../common/Panel";

import { useAssist } from "../../assist/assistContext";
import {
  ROLE_DESCRIPTIONS,
  ROLE_ICONS,
  ROLE_LABELS,
  type AssistRole,
} from "../../assist/procedures";

const ROLES: AssistRole[] = ["operator", "expert"];

/**
 * Entering Assistance without a role: who are you? The others see it next to your name. An
 * expert's invite link already says, and skips this.
 */
export function RoleChooser() {
  const { setRole } = useAssist();
  return (
    <div className="fixed inset-0 z-40 grid place-items-center p-4 pointer-events-none">
      <Panel
        variant="glass"
        className={cn(
          "pointer-events-auto w-full max-w-sm px-5 py-4 flex flex-col gap-3",
          "shadow-[0_0_30px_rgba(0,0,0,0.15)]",
        )}
      >
        <header>
          <h2 className="font-heading text-base font-bold">
            Who are you in this session?
          </h2>
          <p className="text-2xs text-secondary">
            The others see your role next to your name.
          </p>
        </header>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setRole(role)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border border-tertiary px-3 py-4",
                "hover:border-accent hover:bg-accent/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent",
                "transition-colors",
              )}
            >
              <Icon
                className={cn(
                  "fas text-lg mb-1",
                  ROLE_ICONS[role],
                  role === "expert" && "text-accent-300",
                )}
              />
              <span className="text-sm font-bold">{ROLE_LABELS[role]}</span>
              <span className="text-3xs text-secondary">
                {ROLE_DESCRIPTIONS[role]}
              </span>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
