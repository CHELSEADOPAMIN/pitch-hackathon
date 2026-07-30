package expo.modules.pinchglasses

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.SystemClock
import android.util.Log
import androidx.core.content.ContextCompat
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull

internal class AndroidAudioRouter(context: Context) {
  private companion object {
    private const val logTag = "PinchAudio"
    private const val routeConfirmationTimeoutMs = 5_000L
    private const val routeSettleMs = 300L
  }

  private val appContext = context.applicationContext
  private val audioManager = appContext.getSystemService(AudioManager::class.java)
  private var previousMode: Int? = null

  @SuppressLint("MissingPermission")
  suspend fun select(route: String): Map<String, Any?> {
    require(route == "phone" || route == "m02") {
      "Audio route must be either phone or m02."
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      error("Explicit Pinch audio routing requires Android 12 or newer.")
    }
    if (
      route == "m02" &&
      ContextCompat.checkSelfPermission(
        appContext,
        Manifest.permission.BLUETOOTH_CONNECT,
      ) != PackageManager.PERMISSION_GRANTED
    ) {
      error("Nearby-device permission is required to route calls through M02.")
    }

    if (previousMode == null) {
      previousMode = audioManager.mode
    }
    audioManager.mode = AudioManager.MODE_IN_COMMUNICATION

    val candidates = audioManager.availableCommunicationDevices
    val selected = when (route) {
      "phone" -> candidates.firstOrNull {
        it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
      }

      else -> candidates
        .filter {
          it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
            it.type == AudioDeviceInfo.TYPE_BLE_HEADSET
        }
        .firstOrNull {
          it.productName?.toString()?.startsWith("M02", ignoreCase = true) == true
        }
        ?: candidates.firstOrNull {
          it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
            it.type == AudioDeviceInfo.TYPE_BLE_HEADSET
        }
    } ?: error(
      if (route == "m02") {
        "M02 is not available as an Android communication audio device."
      } else {
        "The phone speaker is not available as a communication audio device."
      },
    )

    val requestedAt = SystemClock.elapsedRealtime()
    Log.i(
      logTag,
      "Communication route requested route=$route device=${selected.productName} " +
        "type=${selected.type}",
    )
    val confirmed = withTimeoutOrNull(routeConfirmationTimeoutMs) {
      awaitSelectedDevice(selected)
    } != null
    if (!confirmed) {
      error(
        "Android did not activate the requested $route audio route within " +
          "${routeConfirmationTimeoutMs}ms.",
      )
    }

    // Android can report the new communication device just before SCO audio is
    // completely stable. Keep this bounded settling window ahead of WebRTC.
    delay(routeSettleMs)
    val confirmationMs = SystemClock.elapsedRealtime() - requestedAt
    Log.i(
      logTag,
      "Communication route confirmed route=$route device=${selected.productName} " +
        "confirmationMs=$confirmationMs",
    )
    return status(route) + ("confirmationMs" to confirmationMs)
  }

  fun clear(): Map<String, Any?> {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      audioManager.clearCommunicationDevice()
    }
    previousMode?.let { audioManager.mode = it }
    previousMode = null
    return status(null)
  }

  fun status(requestedRoute: String? = null): Map<String, Any?> {
    val selected = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      audioManager.communicationDevice
    } else {
      null
    }
    return mapOf(
      "requestedRoute" to requestedRoute,
      "selected" to (selected != null),
      "deviceName" to selected?.productName?.toString(),
      "deviceType" to selected?.type,
    )
  }

  @SuppressLint("MissingPermission")
  private suspend fun awaitSelectedDevice(selected: AudioDeviceInfo) {
    suspendCancellableCoroutine { continuation ->
      val finished = AtomicBoolean(false)
      var listener: AudioManager.OnCommunicationDeviceChangedListener? = null

      fun removeListener() {
        listener?.let {
          runCatching {
            audioManager.removeOnCommunicationDeviceChangedListener(it)
          }
        }
        listener = null
      }

      fun complete(result: Result<Unit>) {
        if (!finished.compareAndSet(false, true)) {
          return
        }
        removeListener()
        if (continuation.isActive) {
          continuation.resumeWith(result)
        }
      }

      listener = AudioManager.OnCommunicationDeviceChangedListener { device ->
        if (device?.id == selected.id) {
          complete(Result.success(Unit))
        }
      }
      audioManager.addOnCommunicationDeviceChangedListener(
        appContext.mainExecutor,
        requireNotNull(listener),
      )
      continuation.invokeOnCancellation {
        if (finished.compareAndSet(false, true)) {
          removeListener()
        }
      }

      if (!audioManager.setCommunicationDevice(selected)) {
        complete(
          Result.failure(
            IllegalStateException(
              "Android rejected the requested communication audio route.",
            ),
          ),
        )
        return@suspendCancellableCoroutine
      }

      if (audioManager.communicationDevice?.id == selected.id) {
        complete(Result.success(Unit))
      }
    }
  }
}
