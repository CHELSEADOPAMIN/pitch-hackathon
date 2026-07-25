import { CameraView } from "expo-camera";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet } from "react-native";

export type ProductCapture = {
  capture: () => Promise<string>;
  isReady: () => boolean;
};

export const ProductCamera = forwardRef<
  ProductCapture,
  { onReady?: () => void }
>(function ProductCamera({ onReady }, captureRef) {
  const cameraRef = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(
    captureRef,
    () => ({
      isReady: () => ready,
      capture: async () => {
        if (!ready || !cameraRef.current)
          throw new Error("The product camera is still warming up.");

        const picture = await cameraRef.current.takePictureAsync({
          pictureRef: true,
          shutterSound: false,
          skipProcessing: false,
        });
        const context = ImageManipulator.manipulate(picture);
        let rendered: Awaited<ReturnType<typeof context.renderAsync>> | null =
          null;
        try {
          if (picture.width > 1024 || picture.height > 1024) {
            context.resize(
              picture.width >= picture.height
                ? { width: 1024 }
                : { height: 1024 },
            );
          }
          rendered = await context.renderAsync();
          const result = await rendered.saveAsync({
            base64: true,
            compress: 0.7,
            format: SaveFormat.JPEG,
          });
          if (!result.base64)
            throw new Error("The product image could not be prepared.");
          return result.base64;
        } finally {
          rendered?.release();
          context.release();
          picture.release();
        }
      },
    }),
    [ready],
  );

  return (
    <CameraView
      animateShutter={false}
      facing="back"
      onCameraReady={() => {
        setReady(true);
        onReady?.();
      }}
      onMountError={() => setReady(false)}
      pointerEvents="none"
      ref={cameraRef}
      style={styles.camera}
    />
  );
});

const styles = StyleSheet.create({
  camera: {
    position: "absolute",
    left: -4,
    bottom: 0,
    width: 2,
    height: 2,
    opacity: 0.01,
  },
});
