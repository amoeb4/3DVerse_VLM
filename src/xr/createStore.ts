import { useSyncExternalStore } from "react";

type SetState<T> = (partial: Partial<T> | ((state: T) => Partial<T>)) => void;

/**
 * A store outside React, read from components with a selector and from anywhere else with
 * `getState()`: the part of zustand's `create` the XR code ported from 3dverse-mobile-viewer
 * uses, so that code reads the same here without the dependency.
 *
 * Selectors must return a value that is stable while the state is (a field, not a new object).
 */
export function createStore<T extends object>(
  init: (set: SetState<T>, get: () => T) => T,
) {
  const listeners = new Set<() => void>();
  // Assigned right below: `init` only calls `set` and `get` later, from the store's own actions.
  let state = undefined as unknown as T;
  const get = () => state;
  const set: SetState<T> = (partial) => {
    const next = typeof partial === "function" ? partial(state) : partial;
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };
  state = init(set, get);

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  function useStore<U>(selector: (state: T) => U): U {
    return useSyncExternalStore(subscribe, () => selector(state));
  }
  useStore.getState = get;
  return useStore;
}
