import { useEffect, useState } from "react";

import { useSessionStore } from "@/store/session-store";

export function useStoreHydrated() {
  const [hydrated, setHydrated] = useState(
    useSessionStore.persist.hasHydrated(),
  );

  useEffect(() => {
    const unsubscribeStart = useSessionStore.persist.onHydrate(() =>
      setHydrated(false),
    );
    const unsubscribeFinish = useSessionStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    return () => {
      unsubscribeStart();
      unsubscribeFinish();
    };
  }, []);

  return hydrated;
}
