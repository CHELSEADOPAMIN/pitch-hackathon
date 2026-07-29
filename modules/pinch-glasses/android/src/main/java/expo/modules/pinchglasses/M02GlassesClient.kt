package expo.modules.pinchglasses

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothStatusCodes
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.util.Base64
import android.util.Log
import androidx.core.content.ContextCompat
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeout

internal class M02GlassesClient(
  private val context: Context,
  private val emitStatus: (String, String?) -> Unit = { _, _ -> },
) {
  companion object {
    private val serialServiceUuid =
      UUID.fromString("de5bf728-d711-4e47-af26-65e3012a5dc7")
    private val serialNotifyUuid =
      UUID.fromString("de5bf729-d711-4e47-af26-65e3012a5dc7")
    private val serialWriteUuid =
      UUID.fromString("de5bf72a-d711-4e47-af26-65e3012a5dc7")
    private val notifyDescriptorUuid =
      UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

    private const val actionGlassesControl = 0x41
    private const val actionDeviceNotification = 0x73
    private const val actionPictureThumbnail = 0xFD
    private const val logTag = "PinchGlasses"
  }

  private val operationMutex = Mutex()

  @Volatile
  private var activeBle: BleSession? = null

  @Volatile
  private var activeDevice: BluetoothDevice? = null

  @Volatile
  private var sessionConnectedAt: Long? = null

  fun status(): Map<String, Any?> {
    val permissionGranted = hasBluetoothPermission()
    val bondedDevice = if (permissionGranted) findBondedM02() else null
    val ble = activeBle
    val connected = ble?.isConnected == true
    return mapOf(
      "available" to (permissionGranted && bondedDevice != null),
      "permissionGranted" to permissionGranted,
      "bonded" to (bondedDevice != null),
      "connected" to connected,
      "deviceName" to (activeDevice?.name ?: bondedDevice?.name),
      "deviceAddress" to (activeDevice?.address ?: bondedDevice?.address),
      "negotiatedMtu" to if (connected) ble?.negotiatedMtu else null,
      "sessionAgeMs" to if (connected) {
        sessionConnectedAt?.let { SystemClock.elapsedRealtime() - it }
      } else {
        null
      },
    )
  }

  suspend fun connect(): Map<String, Any?> = operationMutex.withLock {
    checkBluetoothPermission()
    val existing = activeBle
    if (existing?.isConnected == true) {
      emitStatus("ready", activeDevice?.name)
      return@withLock status() + mapOf("connectionMs" to 0)
    }

    closeSession()
    val device = findBondedM02()
      ?: error(
        "No bonded M02 glasses were found. Connect M02 in Android Bluetooth settings first.",
      )
    val startedAt = SystemClock.elapsedRealtime()
    emitStatus("connecting", device.name)
    val ble = BleSession.connect(context, device) { detail ->
      emitStatus("disconnected", detail)
    }
    activeBle = ble
    activeDevice = device
    sessionConnectedAt = SystemClock.elapsedRealtime()
    emitStatus("ready", "${device.name}, MTU ${ble.negotiatedMtu}.")
    status() + mapOf(
      "connectionMs" to (SystemClock.elapsedRealtime() - startedAt),
    )
  }

  suspend fun disconnect(): Map<String, Any?> = operationMutex.withLock {
    closeSession()
    emitStatus("disconnected", "M02 control connection closed.")
    status()
  }

  fun close() {
    closeSession()
  }

  suspend fun captureThumbnail(qualityLevel: Int): Map<String, Any?> =
    operationMutex.withLock {
      checkBluetoothPermission()
      require(qualityLevel in 0..5) {
        "M02 thumbnail quality must be between 0 (Instant) and 5 (Detailed)."
      }
      val ble = activeBle?.takeIf { it.isConnected }
        ?: error(
          "The M02 control session is not connected. Reconnect the selected glasses before retrying.",
        )
      val device = activeDevice
        ?: error("The connected M02 device identity is unavailable.")

      val captureStartedAt = SystemClock.elapsedRealtime()
      var failureStage = "capture"
      try {
        ble.clearFrames(
          actionGlassesControl,
          actionDeviceNotification,
          actionPictureThumbnail,
        )
        emitStatus(
          "capturing",
          "Taking a ${thumbnailQualityName(qualityLevel)} BLE photo with ${device.name}.",
        )
        val commandStartedAt = SystemClock.elapsedRealtime()
        ble.writeControl(
          byteArrayOf(
            2,
            1,
            6,
            qualityLevel.toByte(),
            qualityLevel.toByte(),
          ),
        )

        var commandError: Int? = null
        var commandWorkType: Int? = null
        var commandResponseHex: String? = null
        var thumbnailReadyAt: Long? = null
        withTimeout(8_000) {
          while (thumbnailReadyAt == null) {
            val controlFrame = ble.pollFrame(actionGlassesControl)
            if (
              controlFrame != null &&
              controlFrame.size > 10 &&
              unsigned(controlFrame[7]) == 1 &&
              unsigned(controlFrame[8]) == 6
            ) {
              commandError = unsigned(controlFrame[9])
              commandWorkType = unsigned(controlFrame[10])
              commandResponseHex = controlFrame.toHex()
              Log.i(
                logTag,
                "M02 thumbnail control response: error=$commandError " +
                  "workType=$commandWorkType frame=$commandResponseHex",
              )
              // The vendor SDK uses 0xFF/0xFF as a valid in-progress response.
              if (commandError != 0 && commandError != 0xFF) {
                error(
                  "The glasses rejected the BLE photo command (control error $commandError).",
                )
              }
            }

            val notificationFrame = ble.pollFrame(actionDeviceNotification)
            if (
              notificationFrame != null &&
              notificationFrame.size > 6 &&
              unsigned(notificationFrame[6]) == 2
            ) {
              Log.i(
                logTag,
                "M02 thumbnail ready notification: frame=${notificationFrame.toHex()}",
              )
              thumbnailReadyAt = SystemClock.elapsedRealtime()
              break
            }
            delay(15)
          }
        }

        failureStage = "transfer"
        emitStatus(
          "transferring",
          "Receiving the Fine product photo directly over Bluetooth.",
        )
        val transferStartedAt = SystemClock.elapsedRealtime()
        var firstChunkAt: Long? = null
        var expectedIndex = 0
        var expectedTotal: Int? = null
        val imageBytes = ByteArrayOutputStream()

        while (true) {
          ble.writeFast(
            actionPictureThumbnail,
            byteArrayOf(
              1,
              (expectedIndex and 0xFF).toByte(),
              ((expectedIndex ushr 8) and 0xFF).toByte(),
            ),
          )
          val frame = withTimeout(5_000) {
            ble.awaitFrame(actionPictureThumbnail)
          }
          if (frame.size < 11) {
            error("The M02 returned an incomplete BLE photo packet.")
          }
          val total = littleEndian16(frame, 7)
          val current = littleEndian16(frame, 9)
          if (total !in 1..4_096) {
            error("The M02 returned an invalid BLE photo packet count ($total).")
          }
          if (current != expectedIndex) {
            error(
              "The M02 returned BLE photo packet $current while packet $expectedIndex was expected.",
            )
          }
          if (expectedTotal != null && expectedTotal != total) {
            error("The M02 changed the BLE photo packet count during transfer.")
          }
          expectedTotal = total
          if (firstChunkAt == null) {
            firstChunkAt = SystemClock.elapsedRealtime()
          }
          imageBytes.write(frame, 11, frame.size - 11)
          expectedIndex += 1
          if (expectedIndex == total) {
            break
          }
        }

        failureStage = "JPEG validation"
        val bytes = imageBytes.toByteArray()
        if (
          bytes.size < 4 ||
          unsigned(bytes[0]) != 0xFF ||
          unsigned(bytes[1]) != 0xD8
        ) {
          error("The M02 BLE photo was not a valid JPEG image.")
        }
        val outputDir = File(context.cacheDir, "pinch-glasses").apply { mkdirs() }
        val output = File(
          outputDir,
          "m02-product-q$qualityLevel-${System.currentTimeMillis()}.jpg",
        )
        FileOutputStream(output).use { it.write(bytes) }

        val dimensions = BitmapFactory.Options().also {
          it.inJustDecodeBounds = true
          BitmapFactory.decodeFile(output.absolutePath, it)
        }
        if (dimensions.outWidth <= 0 || dimensions.outHeight <= 0) {
          output.delete()
          error("Android could not decode the M02 BLE photo.")
        }

        val finishedAt = SystemClock.elapsedRealtime()
        emitStatus(
          "ready",
          "${dimensions.outWidth}×${dimensions.outHeight}, ${bytes.size} bytes.",
        )
        mapOf(
          "uri" to Uri.fromFile(output).toString(),
          "base64" to Base64.encodeToString(bytes, Base64.NO_WRAP),
          "width" to dimensions.outWidth,
          "height" to dimensions.outHeight,
          "fileName" to output.name,
          "deviceName" to device.name,
          "qualityLevel" to qualityLevel,
          "qualityName" to thumbnailQualityName(qualityLevel),
          "byteCount" to bytes.size,
          "packetCount" to requireNotNull(expectedTotal),
          "negotiatedMtu" to ble.negotiatedMtu,
          "connectionMs" to 0,
          "shutterMs" to (requireNotNull(thumbnailReadyAt) - commandStartedAt),
          "firstChunkMs" to (requireNotNull(firstChunkAt) - commandStartedAt),
          "transferMs" to (finishedAt - transferStartedAt),
          "totalMs" to (finishedAt - captureStartedAt),
          "commandError" to commandError,
          "commandWorkType" to commandWorkType,
          "commandResponseHex" to commandResponseHex,
        )
      } catch (error: Throwable) {
        closeSession()
        val detail = error.message ?: error.javaClass.simpleName
        emitStatus("error", "M02 $failureStage failed: $detail")
        throw IllegalStateException("M02 $failureStage failed: $detail", error)
      }
    }

  private fun closeSession() {
    activeBle?.close()
    activeBle = null
    activeDevice = null
    sessionConnectedAt = null
  }

  private fun unsigned(byte: Byte): Int = byte.toInt() and 0xFF

  private fun littleEndian16(bytes: ByteArray, offset: Int): Int =
    unsigned(bytes[offset]) or (unsigned(bytes[offset + 1]) shl 8)

  private fun thumbnailQualityName(level: Int): String =
    listOf("Instant", "Quick", "Smooth", "Fine", "Clearer", "Detailed")[level]

  private fun ByteArray.toHex(): String =
    joinToString("") { "%02X".format(unsigned(it)) }

  private fun checkBluetoothPermission() {
    if (!hasBluetoothPermission()) {
      error("Nearby-device permission is required to use the M02 glasses.")
    }
  }

  private fun hasBluetoothPermission(): Boolean {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
      (
        ContextCompat.checkSelfPermission(
          context,
          Manifest.permission.BLUETOOTH_CONNECT,
        ) == PackageManager.PERMISSION_GRANTED &&
          ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.BLUETOOTH_SCAN,
          ) == PackageManager.PERMISSION_GRANTED
        )
  }

  @SuppressLint("MissingPermission")
  private fun findBondedM02(): BluetoothDevice? {
    val manager = context.getSystemService(BluetoothManager::class.java)
    return manager.adapter?.bondedDevices
      ?.firstOrNull { it.name?.startsWith("M02", ignoreCase = true) == true }
  }

  private class BleSession private constructor(
    private val gatt: BluetoothGatt,
    private val writeCharacteristic: BluetoothGattCharacteristic,
    private val framesByAction: ConcurrentHashMap<Int, Channel<ByteArray>>,
    private val connected: AtomicBoolean,
    val negotiatedMtu: Int,
  ) {
    val isConnected: Boolean
      get() = connected.get()

    companion object {
      @SuppressLint("MissingPermission")
      suspend fun connect(
        context: Context,
        device: BluetoothDevice,
        onDisconnected: (String) -> Unit,
      ): BleSession {
        val ready = CompletableDeferred<BleSession>()
        val setupCompleted = AtomicBoolean(false)
        val connected = AtomicBoolean(false)
        val framesByAction = ConcurrentHashMap<Int, Channel<ByteArray>>()
        var discoveredWrite: BluetoothGattCharacteristic? = null
        var discoveredNotify: BluetoothGattCharacteristic? = null
        var negotiatedMtu = 23
        val assembler = FrameAssembler { frame ->
          val action = frame[1].toInt() and 0xFF
          framesByAction
            .getOrPut(action) { Channel(Channel.UNLIMITED) }
            .trySend(frame)
        }

        fun fail(gatt: BluetoothGatt, message: String) {
          connected.set(false)
          if (setupCompleted.compareAndSet(false, true)) {
            ready.completeExceptionally(IllegalStateException(message))
            runCatching { gatt.disconnect() }
          } else {
            onDisconnected(message)
          }
        }

        fun enableNotifications(gatt: BluetoothGatt) {
          if (setupCompleted.get()) {
            return
          }
          val notifyCharacteristic = discoveredNotify
          if (notifyCharacteristic == null) {
            fail(gatt, "The M02 notification characteristic is unavailable.")
            return
          }
          val descriptor = notifyCharacteristic.getDescriptor(notifyDescriptorUuid)
          if (
            descriptor == null ||
            !gatt.setCharacteristicNotification(notifyCharacteristic, true)
          ) {
            fail(gatt, "Could not enable M02 Bluetooth notifications.")
            return
          }
          @Suppress("DEPRECATION")
          val started = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            gatt.writeDescriptor(
              descriptor,
              BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE,
            ) == BluetoothStatusCodes.SUCCESS
          } else {
            descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            gatt.writeDescriptor(descriptor)
          }
          if (!started) {
            fail(gatt, "Could not configure M02 Bluetooth notifications.")
          }
        }

        val callback = object : BluetoothGattCallback() {
          override fun onConnectionStateChange(
            gatt: BluetoothGatt,
            status: Int,
            newState: Int,
          ) {
            if (
              status == BluetoothGatt.GATT_SUCCESS &&
              newState == BluetoothProfile.STATE_CONNECTED
            ) {
              if (!gatt.discoverServices()) {
                fail(gatt, "Could not discover M02 Bluetooth services.")
              }
              return
            }
            if (newState == BluetoothProfile.STATE_DISCONNECTED) {
              fail(gatt, "The M02 Bluetooth connection closed (status $status).")
            }
          }

          override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (setupCompleted.get()) {
              return
            }
            if (status != BluetoothGatt.GATT_SUCCESS) {
              fail(gatt, "M02 service discovery failed (status $status).")
              return
            }
            val service: BluetoothGattService? = gatt.getService(serialServiceUuid)
            val writeCharacteristic = service?.getCharacteristic(serialWriteUuid)
            val notifyCharacteristic = service?.getCharacteristic(serialNotifyUuid)
            if (writeCharacteristic == null || notifyCharacteristic == null) {
              fail(
                gatt,
                "The connected glasses do not expose the M02 control and notification service.",
              )
              return
            }
            discoveredWrite = writeCharacteristic
            discoveredNotify = notifyCharacteristic
            runCatching {
              gatt.requestConnectionPriority(
                BluetoothGatt.CONNECTION_PRIORITY_HIGH,
              )
            }
            if (!gatt.requestMtu(517)) {
              enableNotifications(gatt)
            }
          }

          override fun onMtuChanged(
            gatt: BluetoothGatt,
            mtu: Int,
            status: Int,
          ) {
            negotiatedMtu = if (status == BluetoothGatt.GATT_SUCCESS) mtu else 23
            enableNotifications(gatt)
          }

          override fun onDescriptorWrite(
            gatt: BluetoothGatt,
            descriptor: BluetoothGattDescriptor,
            status: Int,
          ) {
            if (descriptor.uuid != notifyDescriptorUuid || setupCompleted.get()) {
              return
            }
            val writeCharacteristic = discoveredWrite
            if (status != BluetoothGatt.GATT_SUCCESS || writeCharacteristic == null) {
              fail(gatt, "M02 notification setup failed (status $status).")
              return
            }
            if (setupCompleted.compareAndSet(false, true)) {
              connected.set(true)
              ready.complete(
                BleSession(
                  gatt,
                  writeCharacteristic,
                  framesByAction,
                  connected,
                  negotiatedMtu,
                ),
              )
            }
          }

          @Deprecated("Deprecated in Android 13")
          override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
          ) {
            assembler.accept(characteristic.value ?: return)
          }

          override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray,
          ) {
            assembler.accept(value)
          }
        }

        val gatt = device.connectGatt(
          context,
          false,
          callback,
          BluetoothDevice.TRANSPORT_LE,
        )
        return try {
          withTimeout(12_000) { ready.await() }
        } catch (error: Throwable) {
          gatt.close()
          throw error
        }
      }
    }

    @SuppressLint("MissingPermission")
    suspend fun writeControl(payload: ByteArray) {
      writePacket(actionGlassesControl, payload, 250)
    }

    suspend fun writeFast(action: Int, payload: ByteArray) {
      writePacket(action, payload, 15)
    }

    @Suppress("DEPRECATION")
    @SuppressLint("MissingPermission")
    private suspend fun writePacket(
      action: Int,
      payload: ByteArray,
      settleMs: Long,
    ) {
      check(isConnected) { "The M02 Bluetooth connection is not active." }
      val packet = frame(action, payload)
      val started = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        gatt.writeCharacteristic(
          writeCharacteristic,
          packet,
          BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE,
        ) == BluetoothStatusCodes.SUCCESS
      } else {
        writeCharacteristic.writeType =
          BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
        writeCharacteristic.value = packet
        gatt.writeCharacteristic(writeCharacteristic)
      }
      if (!started) {
        error("The M02 Bluetooth command could not be sent.")
      }
      if (settleMs > 0) {
        delay(settleMs)
      }
    }

    suspend fun awaitFrame(action: Int): ByteArray =
      framesByAction
        .getOrPut(action) { Channel(Channel.UNLIMITED) }
        .receive()

    fun pollFrame(action: Int): ByteArray? =
      framesByAction
        .getOrPut(action) { Channel(Channel.UNLIMITED) }
        .tryReceive()
        .getOrNull()

    fun clearFrames(vararg actions: Int) {
      actions.forEach { action ->
        while (pollFrame(action) != null) {
          // Drain stale command and thumbnail responses from the warm session.
        }
      }
    }

    @SuppressLint("MissingPermission")
    fun close() {
      connected.set(false)
      runCatching { gatt.disconnect() }
      gatt.close()
      framesByAction.values.forEach { it.close() }
      framesByAction.clear()
    }

    private fun frame(action: Int, payload: ByteArray): ByteArray {
      val crc = crc16(payload)
      return byteArrayOf(
        0xBC.toByte(),
        action.toByte(),
        (payload.size and 0xFF).toByte(),
        ((payload.size ushr 8) and 0xFF).toByte(),
        (crc and 0xFF).toByte(),
        ((crc ushr 8) and 0xFF).toByte(),
      ) + payload
    }

    private fun crc16(bytes: ByteArray): Int {
      var crc = 0xFFFF
      bytes.forEach { byte ->
        crc = crc xor (byte.toInt() and 0xFF)
        repeat(8) {
          crc = if ((crc and 1) != 0) {
            (crc ushr 1) xor 0xA001
          } else {
            crc ushr 1
          }
        }
      }
      return crc and 0xFFFF
    }

    private class FrameAssembler(
      private val publish: (ByteArray) -> Unit,
    ) {
      private var buffer = byteArrayOf()
      private var lastFragmentAt = 0L

      @Synchronized
      fun accept(fragment: ByteArray) {
        val now = SystemClock.elapsedRealtime()
        if (buffer.isNotEmpty() && now - lastFragmentAt > 5_000) {
          buffer = byteArrayOf()
        }
        lastFragmentAt = now
        buffer += fragment

        while (true) {
          val prefix = buffer.indexOf(0xBC.toByte())
          if (prefix < 0) {
            buffer = byteArrayOf()
            return
          }
          if (prefix > 0) {
            buffer = buffer.copyOfRange(prefix, buffer.size)
          }
          if (buffer.size < 6) {
            return
          }
          val payloadLength =
            (buffer[2].toInt() and 0xFF) or
              ((buffer[3].toInt() and 0xFF) shl 8)
          if (payloadLength !in 0..65_535) {
            buffer = buffer.copyOfRange(1, buffer.size)
            continue
          }
          val frameLength = payloadLength + 6
          if (buffer.size < frameLength) {
            return
          }
          publish(buffer.copyOfRange(0, frameLength))
          buffer = if (buffer.size == frameLength) {
            byteArrayOf()
          } else {
            buffer.copyOfRange(frameLength, buffer.size)
          }
        }
      }
    }
  }
}
