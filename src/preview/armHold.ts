/**
 * Whether something in this viewer has taken the arm from the live feed: Preview, while it plays
 * a program back on it. Meanwhile, the feed's joint angles are not applied (`WebSocketProvider`);
 * the arm follows the feed again once let go.
 */
let holders = 0;

export function isArmHeld(): boolean {
  return holders > 0;
}

/** Takes the arm; call what it returns to let it go. */
export function holdArm(): () => void {
  holders += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
  };
}
