import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type DeviceProfile = 'phone' | 'm02';

type DeviceProfileState = {
  profile: DeviceProfile;
  setProfile: (profile: DeviceProfile) => void;
};

export const useDeviceProfileStore = create<DeviceProfileState>()(
  persist(
    (set) => ({
      profile: 'phone',
      setProfile: (profile) => set({ profile }),
    }),
    {
      name: 'pinch-device-profile',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
