package com.charles.careeros.companion

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.charles.careeros.companion.challenge.Challenge
import com.charles.careeros.companion.challenge.ListeningService
import com.charles.careeros.companion.pairing.SecureCaptureActivity
import com.google.zxing.integration.android.IntentIntegrator
import java.io.FileDescriptor
import java.io.PrintWriter

class MainActivity : Activity() {
    private val session get() = (application as CompanionApp).session
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var summary: TextView
    private lateinit var live: LinearLayout
    private var transientDialog: AlertDialog? = null
    private var dialogChallengeId: String? = null
    private val updater = object : Runnable {
        override fun run() { refresh(); handler.postDelayed(this, 1000) }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        super.onCreate(null)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(28, 40, 28, 32)
            setBackgroundColor(Color.rgb(246, 248, 250)); importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
        }
        root.addView(label("CareerOS 手机伴侣", 25f))
        root.addView(label("与电脑配对后，仅接收当前登录请求的验证码。每次发送前都需你确认。", 15f))
        summary = label(""); root.addView(summary)
        root.addView(button("扫码配对") {
            IntentIntegrator(this).setCaptureActivity(SecureCaptureActivity::class.java)
                .setDesiredBarcodeFormats(IntentIntegrator.QR_CODE).setPrompt("扫描电脑上的配对二维码")
                .setBeepEnabled(false).setBarcodeImageEnabled(false).initiateScan()
        })
        root.addView(button("粘贴配对文本") { pairDialog() })
        root.addView(button("授权接收新短信") {
            val permissions = mutableListOf(Manifest.permission.RECEIVE_SMS)
            if (Build.VERSION.SDK_INT >= 33) permissions.add(Manifest.permission.POST_NOTIFICATIONS)
            requestPermissions(permissions.toTypedArray(), 10)
        })
        root.addView(button("开始接码") {
            startForegroundService(Intent(this, ListeningService::class.java)); handler.postDelayed({ refresh() }, 250)
        })
        root.addView(button("停止接码并清空") { session.stop(); stopService(Intent(this, ListeningService::class.java)); refresh() })
        root.addView(button("刷新配对状态") { session.refreshAsync() })
        live = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }; root.addView(live)
        setContentView(ScrollView(this).apply { addView(root); isSaveEnabled = false })
    }
    override fun onResume() { super.onResume(); handler.post(updater) }
    override fun onPause() { handler.removeCallbacks(updater); transientDialog?.dismiss(); super.onPause() }
    override fun onSaveInstanceState(outState: Bundle) { /* No secret text or view state is persisted. */ }
    override fun dump(prefix: String, fd: FileDescriptor?, writer: PrintWriter, args: Array<out String>?) {
        if (args?.contains("careeros-status") == true) {
            writer.println("${prefix}CareerOS_DIAGNOSTICS ${session.diagnostics()}")
        } else super.dump(prefix, fd, writer, args)
    }
    private fun label(text: String, size: Float = 15f) = TextView(this).apply {
        this.text = text; textSize = size; setTextColor(Color.rgb(30, 43, 55)); setPadding(0, 12, 0, 12); isSaveEnabled = false
    }
    private fun button(text: String, action: () -> Unit) = Button(this).apply {
        this.text = text; isAllCaps = false; setOnClickListener { action() }; isSaveEnabled = false
    }
    private fun secureInput(hint: String) = EditText(this).apply {
        this.hint = hint; isSaveEnabled = false; setFreezesText(false)
        importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
        inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        imeOptions = android.view.inputmethod.EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
    }
    private fun secureDialog(builder: AlertDialog.Builder, challengeId: String? = null, clear: () -> Unit = {}): AlertDialog {
        transientDialog?.dismiss()
        val dialog = builder.create()
        transientDialog = dialog
        dialogChallengeId = challengeId
        dialog.window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        dialog.setOnDismissListener { clear(); if (transientDialog === dialog) { transientDialog = null; dialogChallengeId = null } }
        dialog.show()
        return dialog
    }
    private fun pairDialog() {
        val input = secureInput("粘贴电脑生成的完整 JSON 配对文本")
        secureDialog(AlertDialog.Builder(this).setTitle("导入配对").setView(input)
            .setMessage("请只导入你信任的电脑生成的配对文本。导入后在电脑核对设备标识和校验串。")
            .setPositiveButton("导入") { _, _ -> val text = input.text.toString(); input.text.clear(); session.work { session.pair(text) } }
            .setNegativeButton("取消", null)) { input.text.clear() }
    }
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        val result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data)
        if (result != null) {
            result.contents?.let { text -> session.work { session.pair(text) } }
            data?.replaceExtras(Bundle())
        } else super.onActivityResult(requestCode, resultCode, data)
    }
    private fun refresh() {
        val permission = checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
        summary.text = "${session.status}\n短信权限：${if (permission) "已授权" else "未授权，可手动粘贴"}\n服务：${if (session.running) "运行中" else "已停止"}"
        live.removeAllViews()
        live.addView(label(session.diagnosticSummary()))
        live.addView(label("配对电脑", 20f))
        val devices = session.devices()
        if (devices.isEmpty()) live.addView(label("尚未配对。请在电脑创建配对请求。"))
        devices.forEach { device ->
            live.addView(label("${device.desktopId}\n${device.baseUrl}\n${if (device.active) "已确认" else "待电脑确认或已撤销"} · 校验串 ${device.confirmationCode}"))
            live.addView(button("撤销此配对") {
                secureDialog(AlertDialog.Builder(this).setTitle("撤销配对")
                    .setMessage("撤销后，此电脑的当前请求与凭据将失效。")
                    .setPositiveButton("撤销") { _, _ -> session.work("revoke:${device.deviceId}") { session.revoke(device) } }.setNegativeButton("取消", null))
            })
        }
        live.addView(label("当前请求", 20f))
        val challenges = session.challenges()
        if (dialogChallengeId != null && (!session.running || challenges.none { it.id == dialogChallengeId })) transientDialog?.dismiss()
        if (challenges.isEmpty()) live.addView(label("没有可接收的请求。请保持接码开启，并在电脑发起请求。"))
        val candidates = session.candidates()
        challenges.forEach { challenge ->
            val seconds = ((challenge.expiresAt - System.currentTimeMillis()) / 1000).coerceAtLeast(0)
            live.addView(label("${challenge.site} · ${challenge.phoneKey}\n电脑 ${challenge.desktopId}\n任务 ${challenge.operationKey}\n发送方 ${challenge.sender}${if (challenge.senderMatch == "prefix") " 号段" else ""} · 标记 ${challenge.bodyMarker}\n${challenge.codeLength} 位数字 · ${seconds} 秒后过期${challenge.subscriptionId?.let { " · SIM $it" } ?: ""}"))
            live.addView(button("手动粘贴并匹配") { manualDialog(challenge) })
            if (challenge.site == "synthetic") live.addView(button("生成合成测试候选") {
                try { session.synthetic(challenge); refresh() } catch (_: Exception) { refresh() }
            })
            candidates.filter { it.challengeId == challenge.id && it.deviceId == challenge.deviceId }.forEach { candidate ->
                live.addView(button("查看候选 ${candidate.code}（${candidate.source}）") {
                    secureDialog(AlertDialog.Builder(this).setTitle("确认发送验证码")
                        .setMessage("发送至 ${challenge.desktopId}\n站点 ${challenge.site}\n任务 ${challenge.operationKey}\n验证码 ${candidate.code}")
                        .setPositiveButton("确认发送") { _, _ -> session.work("confirm:${candidate.deviceId}") { session.confirm(candidate) } }.setNegativeButton("取消", null), challenge.id)
                })
            }
        }
    }
    private fun manualDialog(challenge: Challenge) {
        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(32, 8, 32, 8) }
        val sender = secureInput(if (challenge.senderMatch == "prefix") "实际短信发送方（106 号段完整号码）" else "短信发送方（需与请求一致）")
        val body = secureInput("粘贴完整短信（不会保存）")
        val subscription = secureInput("SIM 订阅 ID，可留空").apply { inputType = InputType.TYPE_CLASS_NUMBER }
        layout.addView(sender); layout.addView(body); layout.addView(subscription)
        secureDialog(AlertDialog.Builder(this).setTitle("手动匹配当前请求").setView(layout)
            .setMessage("仅处理你本次主动粘贴的内容；匹配后仍需点选确认发送。")
            .setPositiveButton("匹配") { _, _ ->
                session.acceptManual(challenge.id, sender.text.toString(), body.text.toString(), subscription.text.toString().toIntOrNull())
                sender.text.clear(); body.text.clear(); subscription.text.clear(); refresh()
            }.setNegativeButton("取消", null), challenge.id) { sender.text.clear(); body.text.clear(); subscription.text.clear() }
    }
}
