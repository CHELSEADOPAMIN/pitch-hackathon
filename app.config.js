/** @type {import('expo/config').ExpoConfig} */
const owner = process.env.EXPO_OWNER ?? 'chelsea_yang';
const easProjectId =
  process.env.EXPO_EAS_PROJECT_ID ??
  (owner === 'chelsea_yang'
    ? '365da739-7c8b-49a2-9ea2-db9842d59a25'
    : undefined);
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
const pinchPublishableKey =
  process.env.EXPO_PUBLIC_PINCH_PUBLISHABLE_KEY ??
  process.env.PINCH_PUBLISHABLE_KEY;

if (process.env.PINCH_FINAL_BUILD === '1') {
  if (!apiUrl?.startsWith('https://')) {
    throw new Error('Final builds require EXPO_PUBLIC_API_URL to use HTTPS.');
  }
  if (!pinchPublishableKey?.startsWith('pk_test_')) {
    throw new Error('Final builds require EXPO_PUBLIC_PINCH_PUBLISHABLE_KEY.');
  }
}

const config = {
  name: process.env.EXPO_APP_NAME ?? 'Pinch M02 SCO Lab',
  slug: process.env.EXPO_APP_SLUG ?? 'pinch-m02-sco-lab',
  owner,
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon-final.png',
  scheme: process.env.EXPO_SCHEME ?? 'pinchm02scolab',
  userInterfaceStyle: 'light',
  android: {
    package:
      process.env.EXPO_ANDROID_PACKAGE ??
      'au.com.crokily.pinchvoice.glasses.sco',
    permissions: ['CAMERA', 'RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS'],
    adaptiveIcon: {
      backgroundColor: '#141812',
      foregroundImage: './assets/images/android-icon-foreground-final.png',
      backgroundImage: './assets/images/android-icon-background-final.png',
      monochromeImage: './assets/images/android-icon-monochrome-final.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon-final.png',
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      'expo-camera',
      {
        cameraPermission:
          'Allow Pinch Voice to use the camera to identify products.',
        microphonePermission:
          'Allow Pinch Voice to hear your shopping requests.',
        recordAudioAndroid: true,
        barcodeScannerEnabled: false,
      },
    ],
    '@config-plugins/react-native-webrtc',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#141812',
        image: './assets/images/splash-icon-final.png',
        imageWidth: 180,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    apiUrl,
    pinchPublishableKey,
    enableDemoControls: process.env.EXPO_PUBLIC_ENABLE_DEMO_CONTROLS === '1',
    eas: easProjectId ? { projectId: easProjectId } : undefined,
  },
};

module.exports = config;
