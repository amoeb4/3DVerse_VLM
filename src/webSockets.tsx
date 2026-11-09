// webSockets.tsx
import {
  useContext,
  useRef,
  useEffect,
  createContext,
  useCallback,
  useState,
} from "react";
import { useEntity, LivelinkContext } from "@3dverse/livelink-react";
import { rotateHierarchy, PartEntitiesContext } from "./partEntitiesContext";
import { useSpeed } from "./components/ControlPanel";
import { LIVE_FEED_URL } from "./config";
import { liveLink, messageTimestamp } from "./live/liveLink";

/** Reconnection attempts before giving up; the LIVE badge can then retry by hand. */
const MAX_RECONNECT_ATTEMPTS = 5;

const WSContext = createContext({
  register: (_setTransform: any, _name: string) => () => {},
});

export function useWebSocket() {
  return useContext(WSContext);
}

//Fonction principale websocket

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [selectedEntityName, setSelectedEntityName] = useState<string | null>(
    null,
  );
  const { speed } = useSpeed();
  const delayMs = Math.max(10, 1000 / speed);
  const { entity: selectedEntity } = useEntity(
    selectedEntityName ? { name: selectedEntityName } : { name: "" },
  );
  const { entitiesMap } = useContext(PartEntitiesContext);
  const { instance } = useContext(LivelinkContext);

  const registry = useRef<{ setter: any; name: string }[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);
  const selectedEntityRef = useRef<string | null>(null);
  const messageQueue = useRef<any[]>([]);
  const [flushTrigger, setFlushTrigger] = useState(0);

  useEffect(() => {
    selectedEntityRef.current = selectedEntity?.name ?? null;
  }, [selectedEntity]);

  const connectWebSocket = useCallback(() => {
    liveLink.connecting(LIVE_FEED_URL);
    const socket = new WebSocket(LIVE_FEED_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      reconnectAttempts.current = 0;
      liveLink.opened();
      if (selectedEntityRef.current) {
        socket.send(`select ${selectedEntityRef.current}`);
      }
    };

    let lastPart1MessageTime = performance.now();
    socket.onmessage = async (event) => {
      const msg = event.data.trim();

      try {
        const parsed = JSON.parse(msg);
        if (
          typeof parsed !== "object" ||
          typeof parsed.name !== "string" ||
          !Array.isArray(parsed.location) ||
          (parsed.location.length !== 3 && parsed.location.length !== 4) ||
          !parsed.location.every((n: number) => typeof n === "number")
        ) {
          return;
        }
        liveLink.message(messageTimestamp(parsed));

        if (!instance || entitiesMap.size === 0) {
          return;
        }

        if (parsed.name === "part_1") {
          const now = performance.now();
          //          const deltaTime = now - lastPart1MessageTime;
          lastPart1MessageTime = now;
          //          if(deltaTime > 100) {
          //            console.warn("Warnning, delta time gap:", deltaTime);
          //          }
        }
        const [x, y, z] = parsed.location;
        //console.debug("WS message orientation:", parsed.name, [x, y, z]);
        rotateHierarchy(parsed.name, [x, y, z], entitiesMap);
      } catch (error) {
        console.error("Failed to parse WS message:", error);
      }
    };
    socket.onclose = () => {
      console.log("❌ WebSocket closed");

      const timeout = Math.min(10000, 1000 * 2 ** reconnectAttempts.current);
      reconnectAttempts.current += 1;

      if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
        console.log("❌ Too many connection attempts, aborting.");
        liveLink.closed(null);
        return;
      }
      liveLink.closed(timeout);

      reconnectTimeoutRef.current = window.setTimeout(() => {
        connectWebSocket();
      }, timeout);

      console.log(`🔄 Reconnecting in ${timeout}ms...`);
    };
  }, [instance, entitiesMap, delayMs]);

  // Commented by SEB
  /*
  useEffect(() => {
    if (instance && entitiesMap.size > 0 && messageQueue.current.length > 0) {
      const toProcess = messageQueue.current.splice(0, messageQueue.current.length);
      toProcess.forEach(async (parsed) => {
        const [x, y, z, w = 0] = parsed.location.map(Number);
        rotateHierarchy(parsed.name, [x, y, z], entitiesMap);
      });
    }
  }, [flushTrigger, instance, entitiesMap, delayMs]);
  */

  useEffect(() => {
    if (!instance || entitiesMap.size === 0) {
      return;
    }

    connectWebSocket();

    // A manual retry, from the LIVE badge once the automatic ones are spent.
    liveLink.setReconnect(() => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectAttempts.current = 0;
      connectWebSocket();
    });

    return () => {
      liveLink.setReconnect(null);
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);
      const socket = socketRef.current;
      if (socket) {
        // Closed on purpose: no reconnection, and not reported as a lost link.
        socket.onclose = null;
        socket.close();
      }
    };
  }, [instance, entitiesMap]);

  useEffect(() => {
    if (
      selectedEntity?.name &&
      socketRef.current?.readyState === WebSocket.OPEN
    ) {
      socketRef.current.send(`select ${selectedEntity.name}`);
    }
  }, [selectedEntity]);

  const register = useCallback((setter: any, name: string) => {
    if (!registry.current.some((e) => e.name === name && e.setter === setter)) {
      const entry = { setter, name };
      registry.current.push(entry);
      console.log(`➕ Registered entity: ${name}`);
      return () => {
        registry.current = registry.current.filter((e) => e !== entry);
        console.log(`➖ Unregistered entity: ${name}`);
      };
    }
    return () => {};
  }, []);

  return (
    <WSContext.Provider value={{ register }}>{children}</WSContext.Provider>
  );
}
