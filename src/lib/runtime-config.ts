import Constants from 'expo-constants';

type PublicConfig = {
  apiUrl?: string;
  pinchPublishableKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as PublicConfig;

function metroHostApiUrl() {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:8787` : undefined;
}

export function getApiUrl() {
  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? metroHostApiUrl();
  if (!apiUrl) {
    throw new Error('请配置 EXPO_PUBLIC_API_URL');
  }
  return apiUrl.replace(/\/$/, '');
}

export function getPinchPublishableKey() {
  const key =
    process.env.EXPO_PUBLIC_PINCH_PUBLISHABLE_KEY ?? extra.pinchPublishableKey;
  if (!key) {
    throw new Error('请配置 EXPO_PUBLIC_PINCH_PUBLISHABLE_KEY');
  }
  return key;
}
