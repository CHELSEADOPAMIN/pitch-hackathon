import { useEffect, useState } from "react";

import { subscribeToStoreHydration } from "@/hooks/store-hydration";
import { useSessionStore } from "@/store/session-store";

export function useStoreHydrated() {
  const [hydrated, setHydrated] = useState(
    useSessionStore.persist.hasHydrated(),
  );

  useEffect(
    () => subscribeToStoreHydration(useSessionStore.persist, setHydrated),
    [],
  );

  return hydrated;
}
