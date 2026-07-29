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
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.net.ConnectivityManager
import android.net.Network
import android.net.Uri
import android.net.wifi.WpsInfo
import android.net.wifi.p2p.WifiP2pConfig
import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pManager
import android.os.Build
import android.os.SystemClock
import android.util.Log
import androidx.core.content.ContextCompat
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull

internal class M02GlassesClient(
  private val context: Context,
  private val emitStatus: (String, String?) -> Unit = { _, _ -> },
) {
  companion object {
    private val operationMutex = Mutex()

    private val serialServiceUuid =
      UUID.fromString("de5bf728-d711-4e47-af26-65e3012a5dc7")
    private val serialNotifyUuid =
      UUID.fromString("de5bf729-d711-4e47-af26-65e3012a5dc7")
    private val serialWriteUuid =
      UUID.fromString("de5bf72a-d711-4e47-af26-65e3012a5dc7")
    private val notifyDescriptorUuid =
      UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

    private const val actionGlassesControl = 0x41
    private const val actionWearFunctionSupport = 0x47
    private const val actionDeviceNotification = 0x73
    private const val actionPictureThumbnail = 0xFD
    private const val logTag = "PinchGlasses"
    private val capturePayload = byteArrayOf(2, 1, 1)
    private val transferPayload = byteArrayOf(2, 1, 4, 1)
    private val resetP2pPayload = byteArrayOf(2, 1, 15)
    private val startLivePayload = byteArrayOf(2, 1, 20, 1)
    private val stopLivePayload = byteArrayOf(2, 1, 21, 1)
  }

  fun status(): Map<String, Any?> {
    val permissionGranted = hasBluetoothPermission()
    val device = if (permissionGranted) findBondedM02() else null
    return mapOf(
      "available" to (permissionGranted && device != null),
      "permissionGranted" to permissionGranted,
      "bonded" to (device != null),
      "deviceName" to device?.name,
      "deviceAddress" to device?.address,
    )
  }

  suspend fun capturePhoto(): Map<String, Any?> = operationMutex.withLock {
    checkRequiredPermissions()
    val device = findBondedM02()
      ?: error("No bonded M02 glasses were found. Connect M02 in Android Bluetooth settings first.")

    emitStatus("connecting", device.name)
    val ble = BleSession.connect(context, device)
    var p2p: P2pSession? = null
    try {
      emitStatus("capturing", "Taking a photo with ${device.name}.")
      ble.writeControl(capturePayload)
      delay(2_000)

      emitStatus("transferring", "Opening the glasses transfer network.")
      p2p = P2pSession(context, device)
      p2p.startDiscovery()
      ble.writeControl(transferPayload)

      val groupOwner = p2p.awaitGroupOwner()
      val network = findP2pNetwork()
      emitStatus("downloading", groupOwner.hostAddress)
      val image = downloadNewestImage(network, groupOwner)

      emitStatus("ready", image.name)
      val dimensions = BitmapFactory.Options().also {
        it.inJustDecodeBounds = true
        BitmapFactory.decodeFile(image.absolutePath, it)
      }
      mapOf(
        "uri" to Uri.fromFile(image).toString(),
        "width" to dimensions.outWidth,
        "height" to dimensions.outHeight,
        "fileName" to image.name,
        "deviceName" to device.name,
      )
    } finally {
      runCatching { ble.writeControl(resetP2pPayload) }
      p2p?.close()
      ble.close()
    }
  }

  suspend fun captureThumbnail(qualityLevel: Int): Map<String, Any?> =
    operationMutex.withLock {
      checkBluetoothPermission()
      require(qualityLevel in 0..5) {
        "M02 thumbnail quality must be between 0 (Instant) and 5 (Detailed)."
      }
      val device = findBondedM02()
        ?: error("No bonded M02 glasses were found. Connect M02 in Android Bluetooth settings first.")

      val probeStartedAt = SystemClock.elapsedRealtime()
      emitStatus("connecting", device.name)
      val ble = BleSession.connect(context, device)
      val connectedAt = SystemClock.elapsedRealtime()
      try {
        emitStatus(
          "capturing-thumbnail",
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
              // The vendor SDK treats 0xFF as a valid in-progress response.
              // With work type 0xFF it means the AI photo is being captured.
              if (commandError != 0 && commandError != 0xFF) {
                error("The glasses rejected the BLE thumbnail command (control error $commandError).")
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

        emitStatus(
          "downloading-thumbnail",
          "Receiving the photo directly over Bluetooth.",
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
            error("The M02 returned an incomplete BLE thumbnail packet.")
          }
          val total = littleEndian16(frame, 7)
          val current = littleEndian16(frame, 9)
          if (total !in 1..4_096) {
            error("The M02 returned an invalid BLE thumbnail packet count ($total).")
          }
          if (current != expectedIndex) {
            error(
              "The M02 returned BLE thumbnail packet $current while packet $expectedIndex was expected.",
            )
          }
          if (expectedTotal != null && expectedTotal != total) {
            error("The M02 changed the BLE thumbnail packet count during transfer.")
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

        val bytes = imageBytes.toByteArray()
        if (
          bytes.size < 4 ||
          unsigned(bytes[0]) != 0xFF ||
          unsigned(bytes[1]) != 0xD8
        ) {
          error("The M02 BLE thumbnail was not a valid JPEG image.")
        }
        val outputDir = File(context.cacheDir, "pinch-glasses").apply { mkdirs() }
        val output = File(
          outputDir,
          "m02-thumbnail-q$qualityLevel-${System.currentTimeMillis()}.jpg",
        )
        FileOutputStream(output).use { it.write(bytes) }

        val dimensions = BitmapFactory.Options().also {
          it.inJustDecodeBounds = true
          BitmapFactory.decodeFile(output.absolutePath, it)
        }
        if (dimensions.outWidth <= 0 || dimensions.outHeight <= 0) {
          output.delete()
          error("Android could not decode the M02 BLE thumbnail.")
        }

        val finishedAt = SystemClock.elapsedRealtime()
        emitStatus(
          "thumbnail-ready",
          "${dimensions.outWidth}×${dimensions.outHeight}, ${bytes.size} bytes.",
        )
        mapOf(
          "uri" to Uri.fromFile(output).toString(),
          "width" to dimensions.outWidth,
          "height" to dimensions.outHeight,
          "fileName" to output.name,
          "deviceName" to device.name,
          "qualityLevel" to qualityLevel,
          "qualityName" to thumbnailQualityName(qualityLevel),
          "byteCount" to bytes.size,
          "packetCount" to requireNotNull(expectedTotal),
          "negotiatedMtu" to ble.negotiatedMtu,
          "connectionMs" to (connectedAt - probeStartedAt),
          "shutterMs" to (requireNotNull(thumbnailReadyAt) - commandStartedAt),
          "firstChunkMs" to (requireNotNull(firstChunkAt) - commandStartedAt),
          "transferMs" to (finishedAt - transferStartedAt),
          "totalMs" to (finishedAt - probeStartedAt),
          "commandError" to commandError,
          "commandWorkType" to commandWorkType,
          "commandResponseHex" to commandResponseHex,
        )
      } finally {
        ble.close()
      }
    }

  suspend fun probeLivePreview(): Map<String, Any?> = operationMutex.withLock {
    checkRequiredPermissions()
    val device = findBondedM02()
      ?: error("No bonded M02 glasses were found. Connect M02 in Android Bluetooth settings first.")

    val probeStartedAt = SystemClock.elapsedRealtime()
    var capabilityFrame: ByteArray? = null
    var advertisedSupport: Boolean? = null
    var startAcknowledged: Boolean? = null
    var startErrorCode: Int? = null
    var liveNotificationType: Int? = null
    var glassesIp: String? = null
    var p2pConnected = false
    var tcpConnected = false
    var rtspReachable = false
    var rtspStatusLine: String? = null
    var ipNotificationMs: Long? = null
    var rtspReadyMs: Long? = null
    var errorMessage: String? = null
    var liveStartSent = false

    emitStatus("connecting", device.name)
    val ble = BleSession.connect(context, device)
    var p2p: P2pSession? = null
    try {
      emitStatus("probing-capability", "Reading the glasses Live capability flag.")
      ble.write(
        actionWearFunctionSupport,
        byteArrayOf(1, 0),
      )
      capabilityFrame = withTimeoutOrNull(3_000) {
        ble.awaitFrame(actionWearFunctionSupport)
      }
      advertisedSupport = capabilityFrame?.let(::parseAdvertisedLiveSupport)

      emitStatus(
        "starting-live",
        if (advertisedSupport == true) {
          "The firmware advertises Live preview; starting its stream."
        } else {
          "The firmware does not advertise Live preview; testing the official command directly."
        },
      )
      p2p = P2pSession(context, device)
      p2p.startDiscovery()
      ble.writeControl(startLivePayload)
      liveStartSent = true
      val liveStartedAt = SystemClock.elapsedRealtime()

      emitStatus("connecting-p2p", "Waiting for the glasses streaming network.")
      val outcomeDeadline = liveStartedAt + 15_000
      while (SystemClock.elapsedRealtime() < outcomeDeadline) {
        val controlFrame = ble.pollFrame(actionGlassesControl)
        if (
          controlFrame != null &&
          controlFrame.size > 9 &&
          unsigned(controlFrame[7]) == 1 &&
          unsigned(controlFrame[8]) == 20
        ) {
          startErrorCode = unsigned(controlFrame[9])
          startAcknowledged = startErrorCode == 0
          if (startAcknowledged == false) {
            errorMessage =
              "The glasses rejected Live preview (control error $startErrorCode)."
            break
          }
        }

        val deviceFrame = ble.pollFrame(actionDeviceNotification)
        if (deviceFrame != null && deviceFrame.size > 6) {
          when (val type = unsigned(deviceFrame[6])) {
            8 -> {
              liveNotificationType = type
              if (deviceFrame.size < 11) {
                errorMessage = "The glasses returned an incomplete Live IP notification."
              } else {
                glassesIp = (7..10)
                  .joinToString(".") { unsigned(deviceFrame[it]).toString() }
                ipNotificationMs = SystemClock.elapsedRealtime() - liveStartedAt
              }
            }

            9 -> {
              liveNotificationType = type
              val primary = deviceFrame.getOrNull(7)?.let(::unsigned)
              val secondary = deviceFrame.getOrNull(8)?.let(::unsigned)
              errorMessage =
                "The glasses reported a Live network error ($primary/$secondary)."
            }
          }
        }

        if (glassesIp != null || errorMessage != null) {
          break
        }
        delay(50)
      }

      if (glassesIp == null && errorMessage == null) {
        errorMessage =
          "The glasses did not return a Live stream address within 15 seconds."
      }

      if (glassesIp != null) {
        val network = findP2pNetwork()
        p2pConnected = true
        emitStatus("probing-rtsp", "Testing rtsp://$glassesIp:8554/ch0.")
        val rtsp = probeRtspWithRetry(network, requireNotNull(glassesIp))
        tcpConnected = rtsp.tcpConnected
        rtspReachable = rtsp.reachable
        rtspStatusLine = rtsp.statusLine
        rtspReadyMs = if (rtsp.reachable) {
          SystemClock.elapsedRealtime() - liveStartedAt
        } else {
          null
        }
        if (rtsp.reachable) {
          emitStatus("live-reachable", rtsp.statusLine)
        } else {
          errorMessage = rtsp.error
            ?: "The glasses returned an IP address, but the RTSP stream was not reachable."
        }
      }
    } catch (error: Throwable) {
      if (error is CancellationException) {
        throw error
      }
      errorMessage = error.message ?: error.javaClass.simpleName
    } finally {
      if (liveStartSent) {
        emitStatus("stopping-live", "Stopping the diagnostic stream.")
        runCatching { ble.writeControl(stopLivePayload) }
      }
      p2p?.close()
      ble.close()
    }

    if (!rtspReachable) {
      emitStatus("live-unsupported", errorMessage)
    }
    mapOf(
      "deviceName" to device.name,
      "advertisedSupport" to advertisedSupport,
      "capabilityReceived" to (capabilityFrame != null),
      "capabilityRawHex" to capabilityFrame?.toHex(),
      "startAcknowledged" to startAcknowledged,
      "startErrorCode" to startErrorCode,
      "liveNotificationType" to liveNotificationType,
      "glassesIp" to glassesIp,
      "p2pConnected" to p2pConnected,
      "tcpConnected" to tcpConnected,
      "rtspReachable" to rtspReachable,
      "rtspStatusLine" to rtspStatusLine,
      "ipNotificationMs" to ipNotificationMs,
      "rtspReadyMs" to rtspReadyMs,
      "totalMs" to (SystemClock.elapsedRealtime() - probeStartedAt),
      "error" to errorMessage,
    )
  }

  private fun parseAdvertisedLiveSupport(frame: ByteArray): Boolean? {
    if (
      frame.size <= 12 ||
      unsigned(frame[0]) != 0xBC ||
      unsigned(frame[1]) != actionWearFunctionSupport
    ) {
      return null
    }
    return (unsigned(frame[12]) and 0x80) != 0
  }

  private suspend fun probeRtspWithRetry(
    network: Network,
    host: String,
  ): RtspProbe {
    var last = RtspProbe()
    repeat(10) {
      last = probeRtsp(network, host)
      if (last.reachable) {
        return last
      }
      delay(200)
    }
    return last
  }

  private suspend fun probeRtsp(network: Network, host: String): RtspProbe =
    withContext(Dispatchers.IO) {
      try {
        network.socketFactory.createSocket().use { socket ->
          socket.soTimeout = 800
          socket.connect(InetSocketAddress(host, 8554), 800)
          val request =
            "OPTIONS rtsp://$host:8554/ch0 RTSP/1.0\r\n" +
              "CSeq: 1\r\n" +
              "User-Agent: PinchLiveProbe\r\n\r\n"
          val output = socket.getOutputStream().bufferedWriter(Charsets.US_ASCII)
          output.write(request)
          output.flush()
          val statusLine = socket.getInputStream()
            .bufferedReader(Charsets.US_ASCII)
            .readLine()
          RtspProbe(
            tcpConnected = true,
            reachable = statusLine?.startsWith("RTSP/") == true,
            statusLine = statusLine,
            error = if (statusLine == null) {
              "The RTSP server accepted TCP but returned no RTSP response."
            } else {
              null
            },
          )
        }
      } catch (error: Throwable) {
        RtspProbe(error = error.message ?: error.javaClass.simpleName)
      }
    }

  private data class RtspProbe(
    val tcpConnected: Boolean = false,
    val reachable: Boolean = false,
    val statusLine: String? = null,
    val error: String? = null,
  )

  private fun unsigned(byte: Byte): Int = byte.toInt() and 0xFF

  private fun littleEndian16(bytes: ByteArray, offset: Int): Int =
    unsigned(bytes[offset]) or (unsigned(bytes[offset + 1]) shl 8)

  private fun thumbnailQualityName(level: Int): String =
    listOf("Instant", "Quick", "Smooth", "Fine", "Clearer", "Detailed")[level]

  private fun ByteArray.toHex(): String =
    joinToString("") { "%02X".format(unsigned(it)) }

  private fun checkRequiredPermissions() {
    checkBluetoothPermission()
    if (
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.NEARBY_WIFI_DEVICES,
      ) != PackageManager.PERMISSION_GRANTED
    ) {
      error("Nearby Wi-Fi permission is required to download a photo from the M02 glasses.")
    }
  }

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

  private suspend fun findP2pNetwork(): Network = withTimeout(8_000) {
    val connectivityManager =
      context.getSystemService(ConnectivityManager::class.java)
    while (true) {
      val network = connectivityManager.allNetworks.firstOrNull {
        connectivityManager.getLinkProperties(it)
          ?.interfaceName
          ?.startsWith("p2p", ignoreCase = true) == true
      }
      if (network != null) {
        return@withTimeout network
      }
      delay(200)
    }
    error("The Wi-Fi Direct network did not become available.")
  }

  private suspend fun downloadNewestImage(
    network: Network,
    groupOwner: InetAddress,
  ): File = withContext(Dispatchers.IO) {
    val host = groupOwner.hostAddress
      ?: error("The M02 transfer-network address is unavailable.")
    val manifest = readText(network, host, "/files/media.config")
    val imagePath = manifest
      .lineSequence()
      .map(String::trim)
      .filter(String::isNotEmpty)
      .filter {
        it.endsWith(".jpg", ignoreCase = true) ||
          it.endsWith(".jpeg", ignoreCase = true)
      }
      .lastOrNull()
      ?: error("The M02 media list did not contain a photo.")

    val encodedPath = imagePath
      .split('/')
      .joinToString("/") { Uri.encode(it) }
    val safeName = imagePath
      .substringAfterLast('/')
      .replace(Regex("[^A-Za-z0-9._-]"), "_")
    val outputDir = File(context.cacheDir, "pinch-glasses").apply { mkdirs() }
    val output = File(outputDir, safeName.ifBlank { "m02-capture.jpg" })

    val connection = open(network, host, "/files/$encodedPath")
    try {
      connection.inputStream.use { input ->
        FileOutputStream(output).use { sink -> input.copyTo(sink) }
      }
    } finally {
      connection.disconnect()
    }
    if (output.length() == 0L) {
      output.delete()
      error("The M02 returned an empty photo.")
    }
    output
  }

  private fun readText(network: Network, host: String, path: String): String {
    val connection = open(network, host, path)
    return try {
      connection.inputStream.bufferedReader().use { it.readText() }
    } finally {
      connection.disconnect()
    }
  }

  private fun open(network: Network, host: String, path: String): HttpURLConnection {
    val connection =
      network.openConnection(URL("http", host, 80, path)) as HttpURLConnection
    connection.connectTimeout = 7_000
    connection.readTimeout = 15_000
    connection.useCaches = false
    connection.instanceFollowRedirects = false
    connection.setRequestProperty("Connection", "close")
    connection.setRequestProperty("User-Agent", "okhttp/4.12.0")
    connection.connect()
    if (connection.responseCode !in 200..299) {
      val code = connection.responseCode
      connection.disconnect()
      error("The M02 transfer server returned HTTP $code for $path.")
    }
    return connection
  }

  private class BleSession private constructor(
    private val gatt: BluetoothGatt,
    private val writeCharacteristic: BluetoothGattCharacteristic,
    private val framesByAction: ConcurrentHashMap<Int, Channel<ByteArray>>,
    val negotiatedMtu: Int,
  ) {
    companion object {
      @SuppressLint("MissingPermission")
      suspend fun connect(context: Context, device: BluetoothDevice): BleSession {
        val ready = CompletableDeferred<BleSession>()
        val completed = AtomicBoolean(false)
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
          if (completed.compareAndSet(false, true)) {
            ready.completeExceptionally(IllegalStateException(message))
            runCatching { gatt.disconnect() }
          }
        }

        fun enableNotifications(gatt: BluetoothGatt) {
          if (completed.get()) {
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
            if (completed.get()) {
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
            if (descriptor.uuid != notifyDescriptorUuid || completed.get()) {
              return
            }
            val writeCharacteristic = discoveredWrite
            if (status != BluetoothGatt.GATT_SUCCESS || writeCharacteristic == null) {
              fail(gatt, "M02 notification setup failed (status $status).")
              return
            }
            if (completed.compareAndSet(false, true)) {
              ready.complete(
                BleSession(
                  gatt,
                  writeCharacteristic,
                  framesByAction,
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

    @Suppress("DEPRECATION")
    @SuppressLint("MissingPermission")
    suspend fun writeControl(payload: ByteArray) {
      write(actionGlassesControl, payload)
    }

    @Suppress("DEPRECATION")
    @SuppressLint("MissingPermission")
    suspend fun write(action: Int, payload: ByteArray) {
      writePacket(action, payload, 250)
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

    @SuppressLint("MissingPermission")
    fun close() {
      runCatching { gatt.disconnect() }
      gatt.close()
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
          if (buffer.isEmpty()) {
            return
          }
        }
      }
    }
  }

  @SuppressLint("MissingPermission")
  private class P2pSession(
    private val context: Context,
    private val bluetoothDevice: BluetoothDevice,
  ) {
    private val manager =
      context.getSystemService(Context.WIFI_P2P_SERVICE) as WifiP2pManager
    private val channel = manager.initialize(context, context.mainLooper, null)
    private val groupOwner = CompletableDeferred<InetAddress>()
    private var connecting = false
    private var registered = false

    private val receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
          WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> {
            manager.requestPeers(channel) { list ->
              val peers = list.deviceList
              val match = peers.firstOrNull(::matchesDevice)
                ?: if (peers.size == 1) peers.first() else null
              if (match != null && !connecting && !groupOwner.isCompleted) {
                connect(match)
              }
            }
          }

          WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {
            manager.requestConnectionInfo(channel) { info ->
              if (
                info.groupFormed &&
                info.groupOwnerAddress != null &&
                !groupOwner.isCompleted
              ) {
                groupOwner.complete(info.groupOwnerAddress)
              }
            }
          }
        }
      }
    }

    suspend fun startDiscovery() = withContext(Dispatchers.Main) {
      if (!registered) {
        val filter = IntentFilter().apply {
          addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION)
          addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
          addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
          addAction(WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        } else {
          @Suppress("DEPRECATION")
          context.registerReceiver(receiver, filter)
        }
        registered = true
      }

      manager.discoverPeers(channel, object : WifiP2pManager.ActionListener {
        override fun onSuccess() = Unit

        override fun onFailure(reason: Int) {
          if (!groupOwner.isCompleted) {
            groupOwner.completeExceptionally(
              IllegalStateException("M02 Wi-Fi Direct discovery failed (reason $reason)."),
            )
          }
        }
      })
    }

    suspend fun awaitGroupOwner(): InetAddress =
      withTimeout(25_000) { groupOwner.await() }

    private fun matchesDevice(device: WifiP2pDevice): Boolean {
      val expectedName = bluetoothDevice.name.orEmpty()
      val expectedSuffix = bluetoothDevice.address
        .replace(":", "")
        .takeLast(4)
      return device.deviceName.equals(expectedName, ignoreCase = true) ||
        device.deviceName.startsWith("M02", ignoreCase = true) ||
        device.deviceName.endsWith(expectedSuffix, ignoreCase = true)
    }

    private fun connect(device: WifiP2pDevice) {
      connecting = true
      val config = WifiP2pConfig().apply {
        deviceAddress = device.deviceAddress
        wps.setup = WpsInfo.PBC
      }
      manager.connect(channel, config, object : WifiP2pManager.ActionListener {
        override fun onSuccess() = Unit

        override fun onFailure(reason: Int) {
          connecting = false
          if (!groupOwner.isCompleted) {
            groupOwner.completeExceptionally(
              IllegalStateException("M02 Wi-Fi Direct connection failed (reason $reason)."),
            )
          }
        }
      })
    }

    suspend fun close() = withContext(Dispatchers.Main) {
      runCatching { manager.stopPeerDiscovery(channel, null) }
      runCatching { manager.cancelConnect(channel, null) }
      runCatching { manager.removeGroup(channel, null) }
      if (registered) {
        runCatching { context.unregisterReceiver(receiver) }
        registered = false
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        runCatching { channel.close() }
      }
    }
  }
}
