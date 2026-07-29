package expo.modules.pinchglasses

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import androidx.core.content.ContextCompat

internal class AndroidAudioRouter(context: Context) {
  private val appContext = context.applicationContext
  private val audioManager = appContext.getSystemService(AudioManager::class.java)
  private var previousMode: Int? = null

  @SuppressLint("MissingPermission")
  fun select(route: String): Map<String, Any?> {
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

    if (!audioManager.setCommunicationDevice(selected)) {
      error("Android rejected the requested $route communication audio route.")
    }
    return status(route)
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
}
