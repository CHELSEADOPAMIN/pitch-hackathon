import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { DemoRole, DemoUser } from "@/types/domain";

type SessionState = {
  user: DemoUser | null;
  hasPaymentMethod: boolean;
  role: DemoRole;
  completeLogin: (user: DemoUser, hasPaymentMethod: boolean) => void;
  markPaymentAttached: () => void;
  toggleRole: () => void;
  logout: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      hasPaymentMethod: false,
      role: "customer",
      completeLogin: (user, hasPaymentMethod) =>
        set({ user, hasPaymentMethod, role: "customer" }),
      markPaymentAttached: () => set({ hasPaymentMethod: true }),
      toggleRole: () =>
        set((state) => ({
          role: state.role === "customer" ? "staff" : "customer",
        })),
      logout: () =>
        set({ user: null, hasPaymentMethod: false, role: "customer" }),
    }),
    {
      name: "pinch-voice-demo-session",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ user, hasPaymentMethod, role }) => ({
        user,
        hasPaymentMethod,
        role,
      }),
    },
  ),
);
