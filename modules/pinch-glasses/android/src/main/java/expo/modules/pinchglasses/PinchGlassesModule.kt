package expo.modules.pinchglasses

import android.util.Log
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PinchGlassesModule : Module() {
  private var glassesClient: M02GlassesClient? = null
  private var audioRouter: AndroidAudioRouter? = null

  override fun definition() = ModuleDefinition {
    Name("PinchGlasses")

    Events("onStatusChanged")

    AsyncFunction("getStatusAsync") Coroutine { ->
      client().status()
    }

    AsyncFunction("connectAsync") Coroutine { ->
      client().connect()
    }

    AsyncFunction("disconnectAsync") Coroutine { ->
      client().disconnect()
    }

    AsyncFunction("prepareForRealtimeAsync") Coroutine { ->
      client().prepareForRealtime()
    }

    AsyncFunction("captureThumbnailAsync") Coroutine { qualityLevel: Int ->
      client().captureThumbnail(qualityLevel)
    }

    Function("logTrace") { message: String ->
      Log.i("PinchTrace", message.take(3_500))
    }

    AsyncFunction("setAudioRouteAsync") Coroutine { route: String ->
      router().select(route)
    }

    AsyncFunction("clearAudioRouteAsync") { ->
      router().clear()
    }

    OnDestroy {
      glassesClient?.close()
      glassesClient = null
      audioRouter?.clear()
      audioRouter = null
    }
  }

  private fun client(): M02GlassesClient {
    val current = glassesClient
    if (current != null) {
      return current
    }
    val created = M02GlassesClient(context()) { stage, detail ->
      sendEvent(
        "onStatusChanged",
        mapOf(
          "stage" to stage,
          "detail" to detail,
        ),
      )
    }
    glassesClient = created
    return created
  }

  private fun router(): AndroidAudioRouter {
    val current = audioRouter
    if (current != null) {
      return current
    }
    val created = AndroidAudioRouter(context())
    audioRouter = created
    return created
  }

  private fun context() =
    requireNotNull(appContext.reactContext) {
      "The Android application context is unavailable."
    }
}
