import { useClients } from "@3dverse/livelink-react";
import { Button, cn, Icon } from "@3dverse/ui-lib";

import { useAssist } from "../../assist/assistContext";
import { ParticipantMark } from "../../assist/ParticipantMark";
import {
  useParticipantLook,
  type ParticipantLook,
} from "../../assist/participantLook";
import { SectionTitle } from "../supervision/SupervisionPanel";
import { RoleChip } from "./RoleChip";

/**
 * Who is in the session and in which role, with a way to follow someone's camera: the operator
 * sees what the expert points at, the expert sees what the operator looks at. Those not in the
 * Assistance mode have no role.
 */
export function PeopleSection() {
  const { snapshot, me, role, following, setFollowing } = useAssist();
  const { clients } = useClients();
  const lookOf = useParticipantLook();
  const roles = new Map(
    snapshot.presences.map(({ clientId, role }) => [clientId, role]),
  );

  return (
    <section className="px-4 py-3">
      <SectionTitle>In the session</SectionTitle>
      <ul className="flex flex-col gap-1 empty:hidden">
        {me && <Person look={lookOf(me.clientId)} role={role} isMe />}
        {clients.map((client) => {
          const isFollowed = following === client.id;
          const look = lookOf(client.id, client.username);
          const { name } = look;
          return (
            <Person
              key={client.id}
              look={look}
              role={roles.get(client.id) ?? null}
              action={
                <Button
                  variant={isFollowed ? "accent" : "ghost"}
                  size="icon-xs"
                  className={cn(isFollowed && "text-white!")}
                  aria-pressed={isFollowed}
                  title={
                    isFollowed
                      ? `Stop following ${name}`
                      : `Follow ${name}'s camera`
                  }
                  aria-label={
                    isFollowed
                      ? `Stop following ${name}`
                      : `Follow ${name}'s camera`
                  }
                  onClick={() => setFollowing(isFollowed ? null : client.id)}
                >
                  <Icon className="fas fa-eye text-5xs" />
                </Button>
              }
            />
          );
        })}
      </ul>
      {clients.length === 0 && (
        <p className="mt-1 text-3xs text-tertiary">No one else yet.</p>
      )}
    </section>
  );
}

function Person({
  look,
  role,
  isMe = false,
  action,
}: {
  look: ParticipantLook;
  role: ReturnType<typeof useAssist>["role"];
  isMe?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2 text-2xs min-h-6">
      <span
        className="size-4 shrink-0 grid place-items-center rounded-full text-[50%] uppercase text-white -translate-y-px"
        style={{ background: look.color }}
        aria-hidden
      >
        <ParticipantMark look={look} className="text-5xs" />
      </span>
      <span className="min-w-0 grow truncate">
        {look.name}
        {isMe && (
          <span className="font-normal text-4xs text-tertiary"> (you)</span>
        )}
      </span>
      {role ? (
        <RoleChip role={role} />
      ) : (
        <span className="text-5xs text-tertiary whitespace-nowrap">
          Not in Assist
        </span>
      )}
      {action}
    </li>
  );
}
