import assert from "node:assert/strict";
import test from "node:test";

import { subscribeToStoreHydration } from "./store-hydration.ts";

test("reports hydration that finishes while listeners are being registered", () => {
  let hydrated = false;
  const observedStates = [];

  const persistence = {
    hasHydrated: () => hydrated,
    onHydrate: () => () => {},
    onFinishHydration: () => {
      hydrated = true;
      return () => {};
    },
  };

  subscribeToStoreHydration(persistence, (state) => {
    observedStates.push(state);
  });

  assert.deepEqual(observedStates, [true]);
});
