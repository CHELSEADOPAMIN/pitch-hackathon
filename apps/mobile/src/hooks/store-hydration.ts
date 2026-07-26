type StoreHydrationPersistence = {
  hasHydrated: () => boolean;
  onHydrate: (listener: () => void) => () => void;
  onFinishHydration: (listener: () => void) => () => void;
};

export function subscribeToStoreHydration(
  persistence: StoreHydrationPersistence,
  onHydrationChange: (hydrated: boolean) => void,
) {
  const unsubscribeStart = persistence.onHydrate(() =>
    onHydrationChange(false),
  );
  const unsubscribeFinish = persistence.onFinishHydration(() =>
    onHydrationChange(true),
  );

  onHydrationChange(persistence.hasHydrated());

  return () => {
    unsubscribeStart();
    unsubscribeFinish();
  };
}
