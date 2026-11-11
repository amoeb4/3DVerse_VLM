import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button, cn, Icon } from "@3dverse/ui-lib";
import Dtext from "./Dtext";
import { MACHINES } from "../config";
import { viewerPath } from "../routing";

export const StartupPanel = () => {
  const navigate = useNavigate();
  const [customSceneId, setCustomSceneId] = useState("");

  return (
    <div className="h-dvh w-screen flex items-center justify-center">
      <div className="w-full max-w-md mx-2 px-4 md:px-10 py-4 md:py-6 border border-tertiary bg-ground rounded-3xl [corner-shape:squircle]">
        <Dtext />

        <nav className="flex flex-col mt-6 *:rounded-none *:first:rounded-t-xl! *:last:rounded-b-xl!">
          {MACHINES.map(({ name, sceneId, slug }) => (
            <Button
              key={sceneId}
              as={Link}
              to={viewerPath(slug)}
              variant="outline"
              size="lg"
              className="group w-full justify-between -mt-px py-2 border-secondary hover:border-accent/40 hover:text-accent hover:z-1 transition-all duration-500"
            >
              {name}
              <Icon className="fas fa-angle-right text-3xs opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
            </Button>
          ))}
        </nav>

        <form
          onSubmit={(e) => {
            e.preventDefault(); // keep the browser from reloading the page
            navigate(viewerPath(customSceneId.trim()));
          }}
          className="mt-6 w-full max-w-2xl border-t border-tertiary pt-6"
        >
          <div className="relative flex">
            <input
              type="text"
              name="customSceneId"
              className="w-full px-3 py-1 border border-secondary bg-ground text-xs text-tertiary rounded-xl [corner-shape:squircle] focus:outline-hidden focus:ring-2 focus:ring-accent"
              value={customSceneId}
              placeholder="Custom scene "
              onChange={(e) => setCustomSceneId(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant={customSceneId ? "accent" : "ghost"}
              size="icon-sm"
              className={cn(
                "absolute right-0 top-0 h-full px-4 rounded-l-none",
                customSceneId ? "text-white!" : "",
              )}
            >
              <Icon className="fas fa-angle-right text-3xs" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
