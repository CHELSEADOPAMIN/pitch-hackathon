/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: process.env.EXPO_APP_NAME ?? 'Pinch Voice',
  slug: process.env.EXPO_APP_SLUG ?? 'pinch-voice-shopping',
  owner: process.env.EXPO_OWNER ?? 'chelsea_yang',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: process.env.EXPO_SCHEME ?? 'pinchvoice',
  userInterfaceStyle: 'light',
  android: {
    package:
      process.env.EXPO_ANDROID_PACKAGE ?? 'com.konstruq.pinchvoiceshopping',
    permissions: ['CAMERA', 'RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS'],
    adaptiveIcon: {
      backgroundColor: '#F4F0E6',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      'expo-camera',
      {
        cameraPermission:
          'Allow Pinch Voice to see products you want to add or remove.',
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
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    pinchPublishableKey:
      process.env.EXPO_PUBLIC_PINCH_PUBLISHABLE_KEY ??
      process.env.PINCH_PUBLISHABLE_KEY,
    enableDemoControls: process.env.EXPO_PUBLIC_ENABLE_DEMO_CONTROLS === '1',
    eas: {
      projectId:
        process.env.EXPO_EAS_PROJECT_ID ??
        '365da739-7c8b-49a2-9ea2-db9842d59a25',
    },
  },
};

module.exports = config;
