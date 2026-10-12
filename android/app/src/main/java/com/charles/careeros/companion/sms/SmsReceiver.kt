package com.charles.careeros.companion.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.telephony.SubscriptionManager
import com.charles.careeros.companion.CompanionApp

class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val session = (context.applicationContext as CompanionApp).session
        session.noteSmsBroadcast()
        if (!session.running) return
        try {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            if (messages.isNullOrEmpty()) { session.noteSmsDecodeFailure(); return }
            val sender = messages.first().originatingAddress
            if (sender == null || messages.any { it.originatingAddress != sender }) { session.noteSmsDecodeFailure(); return }
            val body = messages.joinToString("") { it.messageBody.orEmpty() }
            val subscription = intent.getIntExtra(SubscriptionManager.EXTRA_SUBSCRIPTION_INDEX,
                intent.getIntExtra("subscription", -1)).takeIf { it >= 0 }
            session.acceptSms(sender, body, System.currentTimeMillis(), subscription, messages.minOf { it.timestampMillis })
        } catch (_: Exception) {
            session.noteSmsDecodeFailure()
            // Malformed system input is ignored. Neither SMS bodies nor codes are logged.
        }
    }
}
