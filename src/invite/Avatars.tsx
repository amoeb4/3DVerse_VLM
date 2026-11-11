import { useCallback, useEffect, useState } from "react";
import { cn } from "@3dverse/ui-lib";

import type { Client, Entity } from "@3dverse/livelink";
import {
  DOM3DOverlay,
  useClients,
  type DefaultCameraController,
} from "@3dverse/livelink-react";
import { DOM3DAvatar } from "@3dverse/livelink-react-ui";

import { ParticipantMark } from "../assist/ParticipantMark";
import { useParticipantLook } from "../assist/participantLook";
import { triggerHapticFeedback } from "../utils/haptics";

//------------------------------------------------------------------------------
// Must be rendered inside a `Viewport`, since `DOM3DOverlay` projects onto it.
export function Avatars({
  cameraController,
}: {
  cameraController: DefaultCameraController | null;
}) {
  const { clients } = useClients();

  const travelToEntity = useCallback(
    (entity: Entity) => {
      if (!cameraController) {
        return;
      }
      const { position, orientation } = entity.global_transform;
      cameraController.travelToPointOfView({ position, orientation });
      triggerHapticFeedback();
    },
    [cameraController],
  );

  if (clients.length === 0) {
    return null;
  }

  return (
    <DOM3DOverlay>
      {clients.map((client) => (
        <Avatar3D key={client.id} client={client} onTravel={travelToEntity} />
      ))}
    </DOM3DOverlay>
  );
}

//------------------------------------------------------------------------------
const useClientCameraEntity = (client: Client) => {
  const [cameraEntity, setCameraEntity] = useState<Entity | null>(null);

  useEffect(() => {
    let cancelled = false;
    client
      .getCameraEntities()
      .then(
        (cameraEntities) =>
          !cancelled && setCameraEntity(cameraEntities[0] ?? null),
      );
    return () => {
      cancelled = true;
    };
  }, [client]);

  return cameraEntity;
};

//------------------------------------------------------------------------------
const Avatar3D = ({
  client,
  onTravel,
}: {
  client: Client;
  onTravel: (entity: Entity) => void;
}) => {
  const clientCameraEntity = useClientCameraEntity(client);
  const look = useParticipantLook()(client.id, client.username);
  const { color } = look;

  return (
    <DOM3DAvatar
      client={client}
      entity={clientCameraEntity}
      scaleFactor={0.0025}
      color={color}
      label={look.name}
      showOffscreenIndicator
      showViewportRectangle
      onTravel={onTravel}
      className="backdrop-blur-lg uppercase text-2xs font-medium"
      style={{
        color: "white",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: color,
        background: `color-mix(in srgb, ${color} 90%, transparent)`,
      }}
    >
      <ParticipantMark look={look} />
    </DOM3DAvatar>
  );
};

//------------------------------------------------------------------------------
export const AvatarList = ({
  cameraController,
}: {
  cameraController: DefaultCameraController | null;
}) => {
  const { clients } = useClients();

  const handleTravel = useCallback(
    (entity: Entity) => {
      if (!cameraController) {
        return;
      }
      const { position, orientation } = entity.global_transform;
      cameraController.travelToPointOfView({ position, orientation });
      triggerHapticFeedback();
    },
    [cameraController],
  );

  if (clients.length === 0) {
    return null;
  }
  return (
    <div className="flex items-center pl-px" role="none">
      {[...clients].reverse().map((client) => (
        <AvatarBubble key={client.id} client={client} onTravel={handleTravel} />
      ))}
    </div>
  );
};

//------------------------------------------------------------------------------
const AvatarBubble = ({
  client,
  onTravel,
}: {
  client: Client;
  onTravel: (entity: Entity) => void;
}) => {
  const cameraEntity = useClientCameraEntity(client);
  const look = useParticipantLook()(client.id, client.username);
  const { color } = look;
  const displayName = look.name;

  return (
    <div className="relative group -ml-1 first:ml-0">
      <button
        type="button"
        onClick={() => cameraEntity && onTravel(cameraEntity)}
        disabled={!cameraEntity}
        aria-label={`Travel to ${displayName}`}
        className={cn(
          "w-7 aspect-square rounded-full border flex items-center justify-center text-[0.6rem] font-medium text-white/90 uppercase tracking-wide select-none cursor-pointer starting:opacity-0 starting:translate-x-2 transition-all duration-300 ease-out",
          "border-(--client-color) bg-[color-mix(in_srgb,var(--client-color)_85%,black)]",
          "disabled:border-(--client-color)/30 disabled:text-white/50 disabled:bg-[color-mix(in_srgb,var(--client-color)_25%,black)] disabled:cursor-not-allowed",
        )}
        style={
          {
            "--client-color": color,
          } as React.CSSProperties
        }
      >
        <ParticipantMark look={look} className="text-[0.55rem]" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 mt-1 whitespace-nowrap rounded-sm border border-ground/20 bg-ground/80 backdrop-blur-sm px-1 text-[0.65rem] text-primary opacity-0 scale-95 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100"
      >
        Travel to {displayName}
      </span>
    </div>
  );
};
