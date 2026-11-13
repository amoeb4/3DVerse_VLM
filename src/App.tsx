import { useCallback } from "react";
import {
  Navigate,
  Route,
  Routes,
  useParams,
  useSearchParams,
} from "react-router";

import { NotFoundScreen } from "./components/startup/NotFoundScreen";
import { StartupScreen } from "./components/startup/StartupScreen";
import { WelcomePanel } from "./components/WelcomePanel";
import {
  LEGACY_SCENE_ID_PARAM,
  SESSION_ID_PARAM,
  resolveViewerScene,
  viewerPath,
} from "./routing";
import { Viewer } from "./viewer/Viewer";

// The URLs themselves are described in `routing.ts`.
export function App() {
  return (
    <Routes>
      <Route index element={<HomeRoute />} />
      <Route path=":scene" element={<ViewerRoute />} />
      <Route path="*" element={<NotFoundScreen />} />
    </Routes>
  );
}

function HomeRoute() {
  const [searchParams] = useSearchParams();

  // An invite link from before the app had URLs: on to the machine's URL, same session.
  const sessionId = searchParams.get(SESSION_ID_PARAM);
  const sceneId = searchParams.get(LEGACY_SCENE_ID_PARAM);
  if (sessionId && sceneId) {
    return <Navigate replace to={viewerPath(sceneId, sessionId)} />;
  }

  return <StartupScreen />;
}

function ViewerRoute() {
  const { scene: segment = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionId = searchParams.get(SESSION_ID_PARAM) ?? undefined;

  // The session the address names is over (an old invite link, a session everyone left): the
  // address stops naming it, which opens the machine's own, its running session or a new one. The
  // rest of the address stays (the mode, the role), and Back does not return to the dead link.
  const leaveEndedSession = useCallback(() => {
    setSearchParams(
      (params) => {
        params.delete(SESSION_ID_PARAM);
        return params;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const scene = resolveViewerScene(segment);
  if (!scene) {
    return <NotFoundScreen />;
  }
  // `/NJ130-2.05` or a machine's scene UUID: shown under the machine's own URL.
  if (segment !== scene.segment) {
    return <Navigate replace to={viewerPath(scene.segment, sessionId)} />;
  }
  // Keyed, so going to another machine or session starts over with a fresh connection and state.
  return (
    <>
      {/* On a phone, as the machine opens. */}
      <WelcomePanel scene={scene} />
      <Viewer
        key={`${scene.sceneId}/${sessionId ?? ""}`}
        scene={scene}
        sessionId={sessionId}
        onSessionEnded={leaveEndedSession}
      />
    </>
  );
}

export default App;
