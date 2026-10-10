package com.charles.careeros.companion

import android.content.Intent
import android.provider.Telephony
import android.test.InstrumentationTestCase
import com.charles.careeros.companion.pairing.CredentialVault
import com.charles.careeros.companion.pairing.PairingPayload
import com.charles.careeros.companion.sms.SmsReceiver
import com.charles.careeros.companion.transport.BridgeClient
import java.io.File

@Suppress("DEPRECATION")
class DeviceTests : InstrumentationTestCase() {
    override fun setUp() {
        super.setUp()
        // The legacy runner can start its test thread before the target process
        // has created Application on Android 16. Launching the entry Activity
        // makes Application.onCreate a deterministic test precondition.
        val activity = instrumentation.startActivitySync(Intent(instrumentation.targetContext, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        instrumentation.waitForIdleSync()
        instrumentation.runOnMainSync { activity.finish() }
    }
    private val selectedDeviceId get() = (instrumentation as android.test.InstrumentationTestRunner).arguments.getString("deviceId")
    private val context get() = instrumentation.targetContext
    private val session get() = (context.applicationContext as CompanionApp).session

    fun testPairFromPrivateFile() {
        val file = File(context.filesDir, "pairing-test.json")
        assertTrue("Push a fresh pairing-test.json with run-as before pairing", file.isFile)
        val text = file.readText()
        try {
            val payload = PairingPayload.parse(text)
            session.pair(text)
            val stored = CredentialVault(context).read().last()
            assertEquals(payload.desktopId, stored.desktopId)
            assertFalse("Desktop must separately confirm pairing", stored.active)
            val encrypted = File(context.applicationInfo.dataDir, "shared_prefs/paired_devices.xml").readText()
            assertFalse("Credential is encrypted on disk", encrypted.contains(stored.token))
            assertFalse("Pairing text is never persisted", encrypted.contains(payload.secret))
        } finally { file.delete() }
    }

    fun testVerifyCredentialAndTls() {
        val stored = CredentialVault(context).read()
        assertFalse("A paired credential is required", stored.isEmpty())
        val device = selectedDeviceId?.let { id -> stored.single { it.deviceId == id } } ?: stored.last()
        val response = BridgeClient(device).request("GET", "/v1/device")
        assertEquals(device.deviceId, response.getString("deviceId"))
        assertTrue("Desktop confirmation required", response.getBoolean("active"))
        session.refreshNow()
        assertTrue(session.devices().single { it.deviceId == device.deviceId }.active)
    }

    fun testSyntheticCandidate() {
        session.start()
        try {
            session.refreshNow()
            val challenge = session.challenges().single { it.site == "synthetic" && (selectedDeviceId == null || it.deviceId == selectedDeviceId) }
            session.synthetic(challenge)
            val candidate = session.candidates().single { it.challengeId == challenge.id }
            assertEquals("synthetic", candidate.source)
            assertEquals("482731", candidate.code)
            session.confirm(candidate)
            assertTrue("Submitted candidate must leave phone memory", session.candidates().isEmpty())
        } finally { session.stop() }
    }

    fun testStopClearsPendingCandidate() {
        session.start()
        session.refreshNow()
        val challenge = session.challenges().first { it.site == "synthetic" && (selectedDeviceId == null || it.deviceId == selectedDeviceId) }
        session.synthetic(challenge)
        assertFalse(session.candidates().isEmpty())
        session.stop()
        assertTrue(session.candidates().isEmpty())
        assertTrue(session.challenges().isEmpty())
    }

    fun testSmsReceiverParser() {
        // Calls the actual receiver with a synthetic UCS2 PDU. This is a parser test,
        // not evidence of a carrier SMS or delivery of a protected system broadcast.
        session.start()
        try {
            session.refreshNow()
            val challenge = session.challenges().single { it.site == "synthetic" && (selectedDeviceId == null || it.deviceId == selectedDeviceId) }
            session.stop()
            session.start() // Empty local cache: exercise SMS arriving before the next poll.
            val body = "CareerOS-Test 482731"
            val intent = Intent(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
                .putExtra("pdus", arrayOf(pdu("CareerOS", body)))
                .putExtra("format", "3gpp")
            SmsReceiver().onReceive(context, intent)
            val deadline = System.currentTimeMillis() + 12000
            while (session.candidates().isEmpty() && System.currentTimeMillis() < deadline) Thread.sleep(100)
            val candidate = session.candidates().single { it.challengeId == challenge.id }
            assertEquals("sms", candidate.source)
            assertEquals("482731", candidate.code)
            val diagnostics = session.diagnostics()
            assertEquals(1, diagnostics.getInt("broadcastCount"))
            assertEquals(1, diagnostics.getInt("parsedCount"))
            assertTrue(diagnostics.getJSONArray("smsReasons").toString().contains("MATCHED"))
            assertFalse("Diagnostics must not contain the code", diagnostics.toString().contains("482731"))
            // No network submission: synthetic challenges accept synthetic source only.
        } finally { session.stop() }
    }

    fun testCachedSmsMatchesImmediately() {
        session.start()
        try {
            session.refreshNow()
            val challenge = session.challenges().single { it.site == "synthetic" && (selectedDeviceId == null || it.deviceId == selectedDeviceId) }
            val now = System.currentTimeMillis()
            session.acceptSms("CareerOS", "CareerOS-Test 482731", now, challenge.subscriptionId, now)
            assertTrue("Cached requests match before acceptSms returns", session.candidates().any { it.challengeId == challenge.id && it.source == "sms" })
        } finally { session.stop() }
    }

    fun testManualCandidate() {
        session.start()
        try {
            session.refreshNow()
            val challenge = session.challenges().single { it.site == "manual-smoke" && (selectedDeviceId == null || it.deviceId == selectedDeviceId) }
            session.acceptManual(challenge.id, "CareerOS", "CareerOS-Test 482731", null)
            val candidate = session.candidates().single { it.challengeId == challenge.id }
            assertEquals("manual", candidate.source)
            session.confirm(candidate)
            assertTrue(session.candidates().isEmpty())
            assertEquals("SUBMITTED", session.diagnostics().getString("lastSubmit"))
        } finally { session.stop() }
    }

    fun testForegroundServiceLifecycle() {
        val activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        val service = Intent(context, com.charles.careeros.companion.challenge.ListeningService::class.java)
        try {
            instrumentation.waitForIdleSync()
            context.startForegroundService(service)
            val deadline = System.currentTimeMillis() + 5000
            while (!session.running && System.currentTimeMillis() < deadline) Thread.sleep(50)
            assertTrue("User-started foreground service starts the session", session.running)
            val manager = context.getSystemService(android.app.ActivityManager::class.java)
            val serviceInfo = manager.getRunningServices(100).singleOrNull {
                it.service.className == "com.charles.careeros.companion.challenge.ListeningService"
            }
            assertNotNull("Own service should be visible to ActivityManager", serviceInfo)
            assertTrue("Service must carry an ongoing foreground notification", serviceInfo!!.foreground)
            context.stopService(service)
            val stoppedDeadline = System.currentTimeMillis() + 5000
            while (session.running && System.currentTimeMillis() < stoppedDeadline) Thread.sleep(50)
            assertFalse(session.running)
            assertTrue(session.candidates().isEmpty())
            assertTrue(session.challenges().isEmpty())
        } finally {
            context.stopService(service)
            instrumentation.runOnMainSync { activity.finish() }
        }
    }

    fun testManifestSecurity() {
        val info = context.packageManager.getPackageInfo(context.packageName,
            android.content.pm.PackageManager.GET_PERMISSIONS or android.content.pm.PackageManager.GET_RECEIVERS)
        val permissions = info.requestedPermissions.orEmpty().toList()
        assertTrue(permissions.contains("android.permission.RECEIVE_SMS"))
        assertFalse(permissions.contains("android.permission.READ_SMS"))
        assertFalse(permissions.contains("android.permission.SEND_SMS"))
        val receiver = info.receivers.orEmpty().single { it.name.endsWith("SmsReceiver") }
        assertEquals("android.permission.BROADCAST_SMS", receiver.permission)
        assertEquals(0, context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_ALLOW_BACKUP)
    }

    private fun pdu(sender: String, body: String): ByteArray {
        val result = java.io.ByteArrayOutputStream()
        result.write(0) // Default SMSC.
        result.write(0) // SMS-DELIVER.
        result.write((sender.length * 7 + 3) / 4) // Alphanumeric semi-octet count.
        result.write(0xD0)
        val packed = ByteArray((sender.length * 7 + 7) / 8)
        sender.forEachIndexed { index, char ->
            val bit = index * 7
            packed[bit / 8] = (packed[bit / 8].toInt() or (char.code shl (bit % 8))).toByte()
            if (bit % 8 > 1 && bit / 8 + 1 < packed.size) packed[bit / 8 + 1] = (char.code shr (8 - bit % 8)).toByte()
        }
        result.write(packed)
        result.write(0); result.write(8) // Protocol ID, UCS2.
        val now = java.time.ZonedDateTime.now(java.time.ZoneOffset.UTC)
        listOf(now.year % 100, now.monthValue, now.dayOfMonth, now.hour, now.minute, now.second, 0)
            .forEach { result.write(((it % 10) shl 4) or (it / 10)) }
        val bytes = body.toByteArray(Charsets.UTF_16BE)
        result.write(bytes.size); result.write(bytes)
        return result.toByteArray()
    }
}
