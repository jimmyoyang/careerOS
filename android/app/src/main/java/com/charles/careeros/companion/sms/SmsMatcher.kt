package com.charles.careeros.companion.sms

import com.charles.careeros.companion.challenge.Challenge

object SmsMatcher {
    class Result(val codes: List<String>, val reason: String)
    fun extract(challenge: Challenge, sender: String, body: String, receivedAt: Long,
                subscriptionId: Int?, now: Long, messageTimestamp: Long = receivedAt): List<String> =
        evaluate(challenge, sender, body, receivedAt, subscriptionId, now, messageTimestamp).codes

    fun evaluate(challenge: Challenge, sender: String, body: String, receivedAt: Long,
                 subscriptionId: Int?, now: Long, messageTimestamp: Long = receivedAt): Result {
        fun reject(reason: String) = Result(emptyList(), reason)
        if (challenge.state != "awaiting_sms") return reject("NOT_AWAITING")
        if (now >= challenge.expiresAt) return reject("REQUEST_EXPIRED")
        if (now < challenge.createdAt) return reject("REQUEST_NOT_STARTED")
        if (receivedAt < challenge.createdAt) return reject("RECEIVED_BEFORE_REQUEST")
        if (receivedAt >= challenge.expiresAt) return reject("RECEIVED_AFTER_EXPIRY")
        if (receivedAt > now) return reject("RECEIPT_IN_FUTURE")
        // SCTS has one-second precision; receipt time remains millisecond-precise.
        if (messageTimestamp < (challenge.createdAt / 1000) * 1000) return reject("SMS_BEFORE_REQUEST")
        if (messageTimestamp > now) return reject("SMS_IN_FUTURE")
        val senderMatches = when (challenge.senderMatch) {
            "exact" -> sender == challenge.sender
            "prefix" -> challenge.sender == "106" && Regex("^(?:\\+86)?106[0-9]{3,20}$").matches(sender)
            else -> false
        }
        if (!senderMatches) return reject("SENDER_MISMATCH")
        if (challenge.bodyMarker.isBlank() || !body.contains(challenge.bodyMarker)) return reject("MARKER_MISSING")
        if (challenge.subscriptionId != null && subscriptionId != challenge.subscriptionId) return reject("SIM_MISMATCH")
        if (challenge.codeLength !in 4..10) return reject("INVALID_LENGTH")
        val codes = Regex("(?<![0-9])[0-9]{${challenge.codeLength}}(?![0-9])").findAll(body).map { it.value }.distinct().toList()
        return Result(codes, if (codes.isEmpty()) "CODE_NOT_FOUND" else "MATCHED")
    }
}
