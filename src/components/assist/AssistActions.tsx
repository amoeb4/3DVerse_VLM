import { Button, cn, Icon, Kbd } from "@3dverse/ui-lib";

import { useAssist } from "../../assist/assistContext";
import { ToolbarDivider } from "../common/TertiaryToolbar";

/**
 * What one does from the Assistance mode, as entries of the bottom-right toolbar
 * (`TertiaryToolbar`), beside the camera's reset: pin a note on the cell, follow the other side's
 * camera (the operator the expert's, the expert the operator's). An incident is opened from the
 * Diagnostic (`Diagnostic`), once the cell has been looked at.
 *
 * Nothing until a role is chosen.
 */
export function AssistActions() {
  const {
    snapshot,
    me,
    role,
    isPlacingPin,
    pinDraft,
    startPin,
    cancelPin,
    following,
    setFollowing,
  } = useAssist();

  if (!role) return null;

  const other = snapshot.presences.find(
    (presence) => presence.clientId !== me?.clientId && presence.role !== role,
  );
  const followed = following
    ? snapshot.presences.find(({ clientId }) => clientId === following)
    : null;

  if (isPlacingPin) {
    return (
      <>
        <span className="flex items-center gap-1.5 px-2 text-2xs whitespace-nowrap text-informative">
          <Icon className="fas fa-thumbtack" />
          Click anywhere
        </span>
        <Button variant="ghost" size="3xs" onClick={cancelPin}>
          Cancel
          <Kbd className="hidden lg:inline-flex h-min self-center">Esc</Kbd>
        </Button>
        <ToolbarDivider />
      </>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={startPin}
        disabled={pinDraft !== null}
        title="Pin a note on the cel."
        className="gap-2"
      >
        <Icon className="fas fa-thumbtack text-4xs" />
        <span className="hidden sm:inline">Pin a note</span>
      </Button>

      {following ? (
        <Button
          variant="ghost"
          size="sm"
          className={cn("text-accent-300")}
          aria-pressed
          onClick={() => setFollowing(null)}
          title="Stop following, and take the camera back"
        >
          <Icon className="fas fa-eye-slash text-2xs" />
          <span className="hidden sm:inline">
            Stop following{followed ? ` ${followed.name}` : ""}
          </span>
        </Button>
      ) : (
        other && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFollowing(other.clientId)}
            title={`See what ${other.name} sees`}
          >
            <Icon className="fas fa-eye text-2xs" />
            <span className="hidden sm:inline">Follow {other.name}</span>
          </Button>
        )
      )}
      <ToolbarDivider />
    </>
  );
}
