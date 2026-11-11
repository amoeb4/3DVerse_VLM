import { Button, cn, Icon } from "@3dverse/ui-lib";

import { useAssist } from "../../assist/assistContext";

/**
 * What one does from the Assistance mode, as entries of the bottom-right toolbar
 * (`TertiaryToolbar`), beside the camera's reset: pin a note on the cell, follow the other side's
 * camera (the operator the expert's, the expert the operator's). An incident is opened from the
 * Diagnostic (`Diagnostic`), once the cell has been looked at.
 *
 * "Pin a note" stays as it is while the note waits for its place, lit: the confirming line says
 * to click on the cell and how to cancel (`AssistProvider`), and the button itself cancels too.
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

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={isPlacingPin}
        onClick={isPlacingPin ? cancelPin : startPin}
        disabled={pinDraft !== null}
        title={
          isPlacingPin
            ? "Click on the cell to place the note, or here to cancel"
            : "Pin a note on the cell"
        }
        className={cn("gap-2", isPlacingPin && "text-informative!")}
      >
        <Icon className="fas fa-thumbtack text-2xs md:text-4xs" />
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
    </>
  );
}
