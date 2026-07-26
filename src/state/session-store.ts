import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LoginResponse } from '@/contracts/api';

type Role = 'customer' | 'staff';

type SessionState = {
  session: LoginResponse | null;
  role: Role;
  hydrated: boolean;
  setSession: (session: LoginResponse) => void;
  setPaymentMethodBound: () => void;
  setRole: (role: Role) => void;
  switchRole: () => void;
  logout: () => void;
  setHydrated: (hydrated: boolean) => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      role: 'customer',
      hydrated: false,
      setSession: (session) => set({ session, role: 'customer' }),
      setPaymentMethodBound: () =>
        set((state) => ({
          session: state.session
            ? { ...state.session, hasPaymentMethod: true }
            : null,
        })),
      setRole: (role) => set({ role }),
      switchRole: () =>
        set((state) => ({
          role: state.role === 'customer' ? 'staff' : 'customer',
        })),
      logout: () => set({ session: null, role: 'customer' }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'pinch-voice-session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ session, role }) => ({ session, role }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);
