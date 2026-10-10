package com.charles.careeros.companion.challenge

import android.content.Context
import android.os.Build
import com.charles.careeros.companion.pairing.CredentialVault
import com.charles.careeros.companion.pairing.PairedDevice
import com.charles.careeros.companion.pairing.PairingPayload
import com.charles.careeros.companion.sms.SmsMatcher
import com.charles.careeros.companion.sms.SmsSource
import com.charles.careeros.companion.sms.SmsDiagnosticTrace
import com.charles.careeros.companion.transport.BridgeClient
import com.charles.careeros.companion.transport.BridgeException
import com.charles.careeros.companion.transport.DeviceWork
import java.util.concurrent.CompletableFuture
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.json.JSONObject

class Session(context: Context) : SmsSource {
    private val vault = CredentialVault(context)
    private val poller = Executors.newSingleThreadScheduledExecutor()
    private val network = DeviceWork()
    private val revisions = mutableMapOf<String, Long>()
    private val lock = Any()
    private val expiry = Executors.newSingleThreadScheduledExecutor()
    private class IncomingSms(val sender: String, var body: String?, val receivedAt: Long,
        val subscriptionId: Int?, val messageTimestamp: Long, val generation: Long, val diagnosticId: Long, val awaiting: MutableSet<String>)
    private val incoming = mutableListOf<IncomingSms>()
    private val devices = mutableListOf<PairedDevice>()
    private val challenges = mutableListOf<Challenge>()
    private val candidates = mutableListOf<Candidate>()
    private var smsBroadcastCount = 0
    private var smsParsedCount = 0
    private var lastBroadcastAt = 0L
    private val smsTrace = SmsDiagnosticTrace()
    private val smsReasons get() = smsTrace.reasons
    private var lastSubmit = "NONE"
    @Volatile var running = false; private set
    @Volatile var status = "接码未启动"; private set
    private var epoch = 0L
    init {
        try { devices.addAll(vault.read()) } catch (_: Exception) { status = "无法解密配对凭据，请重新配对" }
        poller.scheduleWithFixedDelay({ if (running) refreshAsync() }, 0, 4, TimeUnit.SECONDS)
    }
    fun devices(): List<PairedDevice> = synchronized(lock) { devices.toList() }
    fun challenges(): List<Challenge> = synchronized(lock) { expireLocked(); challenges.toList() }
    fun candidates(): List<Candidate> = synchronized(lock) { expireLocked(); candidates.toList() }
    // Only counters and fixed diagnostic labels; never sender, body, code or credentials.
    fun noteSmsBroadcast() = synchronized(lock) {
        smsBroadcastCount++; lastBroadcastAt = System.currentTimeMillis(); smsTrace.begin()
        smsTrace.recordCurrent(if (running) "BROADCAST_RECEIVED" else "NOT_LISTENING")
    }
    fun noteSmsDecodeFailure() = synchronized(lock) { smsTrace.recordCurrent("DECODE_FAILED") }
    fun diagnostics(): JSONObject = synchronized(lock) {
        expireLocked()
        JSONObject().put("running", running).put("broadcastCount", smsBroadcastCount)
            .put("parsedCount", smsParsedCount).put("lastBroadcastAt", lastBroadcastAt)
            .put("smsReasons", org.json.JSONArray(smsReasons.sorted()))
            .put("activeRequestCount", challenges.size).put("candidateCount", candidates.size)
            .put("lastSubmit", lastSubmit)
    }
    fun diagnosticSummary(): String = synchronized(lock) {
        val message = when {
            "MATCHED" in smsReasons -> "已匹配；点候选后还需在弹窗确认发送"
            "SENDER_MISMATCH" in smsReasons -> "发送方与当前请求不一致"
            "MARKER_MISSING" in smsReasons -> "短信未包含请求要求的签名"
            "SMS_BEFORE_REQUEST" in smsReasons -> "短信时间早于请求"
            "SMS_IN_FUTURE" in smsReasons -> "短信时间晚于手机时间"
            "NO_ACTIVE_REQUEST" in smsReasons -> "收到短信时没有可匹配请求"
            "CODE_NOT_FOUND" in smsReasons -> "未找到符合长度的验证码"
            "SIM_MISMATCH" in smsReasons -> "SIM 与请求不一致"
            "DECODE_FAILED" in smsReasons -> "系统短信解析失败"
            "NOT_LISTENING" in smsReasons -> "收到广播时接码未开启"
            smsReasons.isEmpty() -> "本次应用启动后尚未收到短信广播"
            else -> "短信未满足当前请求的时间或状态要求"
        }
        "接收诊断：广播 $smsBroadcastCount 次，解析 $smsParsedCount 次\n$message"
    }
    private fun expireLocked() {
        val now = System.currentTimeMillis()
        challenges.removeAll { now >= it.expiresAt }
        candidates.removeAll { candidate -> challenges.none { it.id == candidate.challengeId && it.deviceId == candidate.deviceId } }
    }
    fun start() = synchronized(lock) { if (!running) { running = true; epoch++; status = "正在等待当前请求" } }
    fun stop() = synchronized(lock) {
        running = false; epoch++; challenges.clear(); candidates.clear()
        incoming.forEach { it.body = null }; incoming.clear()
        status = "接码已停止，临时验证码已清空"
    }
    fun work(key: String = "pair", action: () -> Unit) { network.submit("action:$key") { try { action() } catch (_: Exception) { status = "操作失败，请检查连接或配对状态" } } }
    fun pair(text: String) {
        val payload = PairingPayload.parse(text)
        val response = BridgeClient(payload.baseUrl, payload.certificateDer).request("POST", "/v1/pairings/complete",
            JSONObject().put("pairingId", payload.pairingId).put("secret", payload.secret).put("deviceName", Build.MODEL))
        require(response.getString("desktopId") == payload.desktopId && response.getString("confirmationCode") == payload.confirmationCode)
        val paired = PairedDevice(response.getString("deviceId"), response.getString("token"), payload.desktopId,
            Build.MODEL, payload.baseUrl, payload.certificateDer, payload.confirmationCode)
        synchronized(lock) {
            devices.removeAll { it.deviceId == paired.deviceId && it.desktopId == paired.desktopId }
            devices.add(paired); vault.write(devices)
            status = "已领取配对，请在电脑核对校验串并确认"
        }
    }
    fun refreshAsync(): List<CompletableFuture<Unit>> {
        val generation = synchronized(lock) { epoch }
        return devices().map { device ->
            network.submit("refresh:${device.deviceId}") { refreshDevice(device, generation) }.also { future ->
                future.whenComplete { _, _ ->
                    val needsFreshRequest = synchronized(lock) {
                        running && epoch == generation && incoming.any { it.body != null && device.deviceId in it.awaiting }
                    }
                    if (needsFreshRequest) expiry.execute { refreshAsync() }
                }
            }
        }
    }
    // Synchronous barrier for instrumentation; the UI and SMS receiver use refreshAsync.
    fun refreshNow() { refreshAsync().forEach { it.get(20, TimeUnit.SECONDS) } }
    private fun refreshDevice(device: PairedDevice, generation: Long) {
        val startedAt = System.currentTimeMillis()
        val revision = synchronized(lock) { revisions[device.deviceId] }
        try {
            val client = BridgeClient(device)
            val info = client.request("GET", "/v1/device")
            require(info.getString("deviceId") == device.deviceId && info.getString("desktopId") == device.desktopId)
            val active = info.getBoolean("active")
            val current = if (running && active) {
                val array = client.request("GET", "/v1/challenges/active").getJSONArray("challenges")
                (0 until array.length()).map { Challenge.parse(array.getJSONObject(it)) }.filter {
                    it.deviceId == device.deviceId && it.desktopId == device.desktopId && it.state == "awaiting_sms" &&
                        it.createdAt <= System.currentTimeMillis() && it.expiresAt > System.currentTimeMillis()
                }
            } else emptyList()
            synchronized(lock) {
                if (generation != epoch || devices.none { it === device } || revisions[device.deviceId] != revision) return@synchronized
                val changed = device.active != active
                device.active = active
                challenges.removeAll { it.deviceId == device.deviceId }; challenges.addAll(current)
                expireLocked(); if (changed) vault.write(devices)
                status = if (!active) "等待电脑确认配对" else if (running) "连接正常，正在等待当前请求" else "连接正常，接码未启动"
            }
        } catch (error: Exception) {
            synchronized(lock) {
                if (generation != epoch || devices.none { it === device } || revisions[device.deviceId] != revision) return@synchronized
                challenges.removeAll { it.deviceId == device.deviceId }; expireLocked()
                if (error is BridgeException && error.status in listOf(401, 403)) {
                    device.active = false; vault.write(devices); status = "配对未确认或已撤销"
                } else status = "连接失败，暂不接收候选；请检查 HTTPS 与网络"
            }
        }

        synchronized(lock) {
            if (generation == epoch) processIncomingLocked(device.deviceId, startedAt)
        }
    }
    private fun processIncomingLocked(deviceId: String, refreshStartedAt: Long) {
        incoming.toList().forEach { pending ->
            if (deviceId !in pending.awaiting || refreshStartedAt < pending.receivedAt) return@forEach
            pending.awaiting.remove(deviceId)
            val text = pending.body
            if (running && pending.generation == epoch && text != null && System.currentTimeMillis() - pending.receivedAt < 10000) {
                accept(pending.sender, text, pending.receivedAt, pending.subscriptionId, "sms", null, pending.messageTimestamp, deviceId, pending.diagnosticId)
            }
            if (pending.awaiting.isEmpty()) { pending.body = null; incoming.remove(pending) }
        }
    }
    fun revoke(device: PairedDevice) {
        try { BridgeClient(device).request("DELETE", "/v1/device") }
        catch (error: BridgeException) { if (error.status != 401) throw error }
        synchronized(lock) {
            revisions[device.deviceId] = (revisions[device.deviceId] ?: 0) + 1
            devices.removeAll { it === device }; challenges.removeAll { it.deviceId == device.deviceId }
            expireLocked(); vault.write(devices); status = "配对已撤销"
        }
    }
    override fun acceptSms(sender: String, body: String, receivedAt: Long, subscriptionId: Int?, messageTimestamp: Long) {
        val pending = synchronized(lock) {
            smsParsedCount++; val diagnosticId = smsTrace.begin()
            if (!running || incoming.size >= 8 || body.length > 32768) return
            // Existing online requests are matched immediately, without any network wait.
            accept(sender, body, receivedAt, subscriptionId, "sms", null, messageTimestamp, diagnosticId=diagnosticId)
            if (devices.isEmpty()) return
            IncomingSms(sender, body, receivedAt, subscriptionId, messageTimestamp, epoch, diagnosticId,
                devices.map { it.deviceId }.toMutableSet()).also { incoming.add(it) }
        }
        // Independent device refreshes close the first-poll gap. Slow/offline peers
        // cannot block an online device; the raw body is never retained past ten seconds.
        expiry.schedule({ synchronized(lock) { pending.body = null; incoming.remove(pending) } }, 10, TimeUnit.SECONDS)
        refreshAsync()
    }
    fun acceptManual(challengeId: String, sender: String, body: String, subscriptionId: Int?) {
        accept(sender, body, System.currentTimeMillis(), subscriptionId, "manual", challengeId)
    }
    private fun accept(sender: String, body: String, receivedAt: Long, subscriptionId: Int?, source: String, onlyChallenge: String?, messageTimestamp: Long = receivedAt, onlyDevice: String? = null, diagnosticId: Long? = null) {
        synchronized(lock) {
            if (!running) return
            expireLocked()
            val eligible = challenges.filter { (onlyChallenge == null || onlyChallenge == it.id) && (onlyDevice == null || onlyDevice == it.deviceId) }
            if (source == "sms" && challenges.isEmpty() && diagnosticId != null) smsTrace.record(diagnosticId, "NO_ACTIVE_REQUEST")
            eligible.forEach { challenge ->
                val result = SmsMatcher.evaluate(challenge, sender, body, receivedAt, subscriptionId, System.currentTimeMillis(), messageTimestamp)
                if (source == "sms" && diagnosticId != null) smsTrace.record(diagnosticId, result.reason)
                result.codes.forEach { code ->
                    if (candidates.none { it.challengeId == challenge.id && it.deviceId == challenge.deviceId && it.code == code }) {
                        candidates.add(Candidate(challenge.id, challenge.deviceId, code, sender, challenge.bodyMarker, receivedAt, subscriptionId, source))
                    }
                }
            }
            status = if (candidates.isEmpty()) "未匹配当前请求，请核对发送方、文案和时间" else "发现候选，请在手机点选确认"
        }
    }
    fun synthetic(challenge: Challenge) {
        require(challenge.site == "synthetic" && challenge.sender == "CareerOS" && challenge.bodyMarker == "CareerOS-Test" && challenge.codeLength == 6)
        synchronized(lock) {
            require(running && challenges.any { it.id == challenge.id && it.deviceId == challenge.deviceId })
            expireLocked()
            require(System.currentTimeMillis() < challenge.expiresAt)
            candidates.add(Candidate(challenge.id, challenge.deviceId, "482731", "CareerOS", "CareerOS-Test",
                System.currentTimeMillis(), challenge.subscriptionId, "synthetic"))
            status = "已生成合成测试候选，请点选确认"
        }
    }
    fun confirm(candidate: Candidate) {
        val device: PairedDevice
        val generation: Long
        synchronized(lock) {
            expireLocked()
            require(running && candidates.contains(candidate)) { "候选已过期" }
            device = devices.first { it.deviceId == candidate.deviceId && it.active }
            generation = epoch
        }
        try {
            BridgeClient(device).request("POST", "/v1/challenges/${candidate.challengeId}/candidates", candidate.toJson())
        } catch (error: Exception) {
            synchronized(lock) { lastSubmit = if (error is BridgeException) "HTTP_${error.status}" else "CONNECTION_FAILED" }
            throw error
        }
        synchronized(lock) {
            lastSubmit = "SUBMITTED"
            revisions[candidate.deviceId] = (revisions[candidate.deviceId] ?: 0) + 1
            candidates.removeAll { it.deviceId == candidate.deviceId && it.challengeId == candidate.challengeId }
            challenges.removeAll { it.deviceId == candidate.deviceId && it.id == candidate.challengeId }
            if (generation == epoch) status = "候选已确认并提交，等待电脑消费"
        }
    }
}
