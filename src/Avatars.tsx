import { useContext, useEffect, useState } from "react";
import BoringAvatar from "boring-avatars";

import type { Client, Entity } from "@3dverse/livelink";
import {
  DOM3DOverlay,
  DOMEntity,
  LivelinkContext,
  useClients,
} from "@3dverse/livelink-react";

export function Avatars() {
  const { instance } = useContext(LivelinkContext);
  const { clients } = useClients();
  const [watchedClient, setWatchedClient] = useState<Client | null>(null);

  useEffect(() => {
    if (watchedClient && !clients.includes(watchedClient)) {
      setWatchedClient(null);
    }
  }, [clients]);
  if (!instance) {
    return null;
  }
  return (
    <>
      <DOM3DOverlay>
        {clients.map((client) => (
          <Avatar3D key={client.id} client={client} />
        ))}
      </DOM3DOverlay>
      <AvatarList
        clients={clients}
        watchedClient={watchedClient}
        setWatchedClient={setWatchedClient}
      />
    </>
  );
}

const AvatarList = ({
  clients,
  watchedClient,
  setWatchedClient,
}: {
  clients: Array<Client>;
  watchedClient: Client | null;
  setWatchedClient: (client: Client | null) => void;
}) => {
  return (
    <div className="absolute left-40 top-4">
      <div className="avatar-group flex gap-1 rtl:space-x-reverse">
        {clients.map((client) => (
          <button
            key={client.id}
            onClick={() =>
              setWatchedClient(client !== watchedClient ? client : null)
            }
            className={`
                            border-2 rounded-full
                            ${client === watchedClient ? " border-accent" : "border-transparent"}
                        `}
          >
            <Avatar client={client} />
          </button>
        ))}
      </div>
    </div>
  );
};

const Avatar = ({ client }: { client: Client }) => {
  return (
    <div title={client.username}>
      <BoringAvatar
        name={client.id}
        size={40}
        variant="beam"
        colors={["#92A1C6", "#146A7C", "#F0AB3D", "#C271B4", "#C20D90"]}
      />
    </div>
  );
};

const Avatar3D = ({ client }: { client: Client }) => {
  const [clientCameraEntity, setClientCameraEntity] = useState<Entity | null>(
    null,
  );

  useEffect(() => {
    client
      .getCameraEntities()
      .then((cameraEntities) => setClientCameraEntity(cameraEntities[0]));
  }, [client]);

  if (!clientCameraEntity) {
    return null;
  }

  return (
    <DOMEntity key={client.id} scaleFactor={0.0025} entity={clientCameraEntity}>
      <Avatar client={client} />
    </DOMEntity>
  );
};
