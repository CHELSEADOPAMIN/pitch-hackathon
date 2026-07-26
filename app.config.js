/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: 'Pinch Voice Codex',
  slug: 'pinch-voice-shopping-codex',
  owner: 'crokily',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'pinchvoicecodex',
  userInterfaceStyle: 'light',
  android: {
    package: 'au.com.crokily.pinchvoice.codex',
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
        cameraPermission: '需要相机来识别你要加入购物车的商品',
        microphonePermission: '需要麦克风来接收语音指令',
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
    eas: {
      projectId: '33b4ba14-80ff-4d92-a16a-9c6bf18d70e1',
    },
  },
};

module.exports = config;
