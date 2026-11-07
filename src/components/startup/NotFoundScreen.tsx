import { Link, useLocation } from "react-router";
import { Button, Icon } from "@3dverse/ui-lib";

import { HOME_PATH } from "../../routing";

/** An address that is neither a machine nor a scene UUID: a typo, or a machine since renamed. */
export function NotFoundScreen() {
  const { pathname } = useLocation();

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-underground">
      <div className="w-full max-w-md mx-2 px-4 md:px-10 py-6 md:py-8 flex flex-col items-center gap-4 text-center border border-tertiary bg-ground rounded-3xl [corner-shape:squircle]">
        <Icon className="fas fa-industry text-2xl text-accent/60" />
        <div>
          <h1 className="font-orbitron text-sm font-bold text-primary">
            No machine here
          </h1>
          <p className="mt-1 text-2xs text-secondary">
            Nothing is set up at{" "}
            <code className="px-1 rounded bg-underground text-primary break-all">
              {pathname}
            </code>
            .
          </p>
        </div>
        <Button as={Link} to={HOME_PATH} variant="outline">
          <Icon className="fas fa-arrow-left text-2xs" />
          Back to Home
        </Button>
      </div>
    </div>
  );
}
