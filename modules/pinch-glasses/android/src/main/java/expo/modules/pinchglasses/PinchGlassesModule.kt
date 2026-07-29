package expo.modules.pinchglasses

import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PinchGlassesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PinchGlasses")

    Events("onStatusChanged")

    AsyncFunction("getStatusAsync") Coroutine { ->
      val context = requireNotNull(appContext.reactContext) {
        "The Android application context is unavailable."
      }
      M02GlassesClient(context).status()
    }

    AsyncFunction("capturePhotoAsync") Coroutine { ->
      val context = requireNotNull(appContext.reactContext) {
        "The Android application context is unavailable."
      }
      M02GlassesClient(context) { stage, detail ->
        sendEvent(
          "onStatusChanged",
          mapOf(
            "stage" to stage,
            "detail" to detail,
          ),
        )
      }.capturePhoto()
    }

    AsyncFunction("captureThumbnailAsync") Coroutine { qualityLevel: Int ->
      val context = requireNotNull(appContext.reactContext) {
        "The Android application context is unavailable."
      }
      M02GlassesClient(context) { stage, detail ->
        sendEvent(
          "onStatusChanged",
          mapOf(
            "stage" to stage,
            "detail" to detail,
          ),
        )
      }.captureThumbnail(qualityLevel)
    }

    AsyncFunction("probeLivePreviewAsync") Coroutine { ->
      val context = requireNotNull(appContext.reactContext) {
        "The Android application context is unavailable."
      }
      M02GlassesClient(context) { stage, detail ->
        sendEvent(
          "onStatusChanged",
          mapOf(
            "stage" to stage,
            "detail" to detail,
          ),
        )
      }.probeLivePreview()
    }
  }
}
