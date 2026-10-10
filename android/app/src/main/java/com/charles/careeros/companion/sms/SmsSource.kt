package com.charles.careeros.companion.sms

interface SmsSource {
    fun acceptSms(sender: String, body: String, receivedAt: Long, subscriptionId: Int?, messageTimestamp: Long = receivedAt)
}
