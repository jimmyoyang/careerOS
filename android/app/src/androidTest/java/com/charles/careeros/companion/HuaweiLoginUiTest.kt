package com.charles.careeros.companion

import android.content.Intent
import android.os.Bundle
import android.test.InstrumentationTestCase
import android.test.InstrumentationTestRunner
import android.view.accessibility.AccessibilityNodeInfo
import com.charles.careeros.companion.challenge.ListeningService

/** Opt-in live acceptance helper. It uses the same two UI clicks as the owner. */
@Suppress("DEPRECATION")
class HuaweiLoginUiTest : InstrumentationTestCase() {
    fun testConfirmLiveHuaweiCandidate() {
        val args = (instrumentation as InstrumentationTestRunner).arguments
        if (args.getString("authorizeHuaweiLoginUi") != "true") return
        val deviceId = requireNotNull(args.getString("deviceId")) { "Explicit deviceId required" }
        val context = instrumentation.targetContext
        instrumentation.startActivitySync(Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        context.startForegroundService(Intent(context, ListeningService::class.java))
        instrumentation.sendStatus(1, Bundle().apply { putString("stream", "HUAWEI_UI_READY\n") })

        val deadline = System.currentTimeMillis() + 180_000
        var opened = false
        var confirmed = false
        var openedOperation: String? = null
        val session = (context.applicationContext as CompanionApp).session
        while (System.currentTimeMillis() < deadline && !confirmed) {
            val root = instrumentation.uiAutomation.rootInActiveWindow
            if (root != null && root.packageName?.toString() == context.packageName) {
                try {
                    val challenge = session.challenges().singleOrNull()
                    val candidate = session.candidates().singleOrNull()
                    val expected = challenge != null && challenge.site == "huawei" &&
                        challenge.phoneKey == "my-phone" && challenge.deviceId == deviceId
                    if (!opened && expected && candidate != null &&
                        candidate.challengeId == challenge!!.id && candidate.deviceId == deviceId &&
                        candidate.source == "sms" && contains(root) { it.contains("任务 ${challenge.operationKey}") }) {
                        opened = click(root) { it == "查看候选 ${candidate.code}（sms）" }
                        if (opened) openedOperation = challenge.operationKey
                    } else if (opened && contains(root) { it == "确认发送验证码" } &&
                        expected && challenge!!.operationKey == openedOperation &&
                        contains(root) { it.contains("站点 huawei\n任务 $openedOperation\n") }) {
                        confirmed = click(root) { it == "确认发送" }
                    }
                } finally { root.recycle() }
            }
            if (!confirmed) Thread.sleep(150)
        }
        assertTrue("Live Huawei candidate dialog must be opened", opened)
        assertTrue("Existing confirmation button must be clicked", confirmed)
        // Submission is asynchronous; desktop Bridge state is the end-to-end oracle.
        Thread.sleep(1500)
        instrumentation.sendStatus(1, Bundle().apply { putString("stream", "HUAWEI_UI_CONFIRMED\n") })
    }

    private fun contains(node: AccessibilityNodeInfo, match: (String) -> Boolean): Boolean {
        if (match(node.text?.toString().orEmpty())) return true
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            try { if (contains(child, match)) return true } finally { child.recycle() }
        }
        return false
    }

    private fun click(node: AccessibilityNodeInfo, match: (String) -> Boolean): Boolean {
        if (node.isEnabled && node.isClickable && match(node.text?.toString().orEmpty())) {
            return node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            try { if (click(child, match)) return true } finally { child.recycle() }
        }
        return false
    }
}
