package com.charles.careeros.companion.challenge

import org.json.JSONObject

data class Challenge(val id: String, val desktopId: String, val deviceId: String, val site: String,
    val phoneKey: String, val operationKey: String, val sender: String, val bodyMarker: String,
    val codeLength: Int, val subscriptionId: Int?, val createdAt: Long, val expiresAt: Long,
    val state: String = "awaiting_sms", val senderMatch: String = "exact") {
    companion object {
        fun parse(json: JSONObject): Challenge = Challenge(json.getString("id"), json.getString("desktopId"),
            json.getString("deviceId"), json.getString("site"), json.getString("phoneKey"), json.getString("operationKey"),
            json.getString("sender"), json.getString("bodyMarker"), json.getInt("codeLength"),
            if (json.has("subscriptionId") && !json.isNull("subscriptionId")) json.getInt("subscriptionId") else null,
            json.getLong("createdAt"), json.getLong("expiresAt"), json.getString("state"), json.optString("senderMatch", "exact"))
    }
}

class Candidate(val challengeId: String, val deviceId: String, val code: String, val sender: String,
                val bodyMarker: String, val receivedAt: Long, val subscriptionId: Int?, val source: String) {
    fun toJson(): JSONObject = JSONObject().put("code", code).put("sender", sender).put("bodyMarker", bodyMarker)
        .put("receivedAt", receivedAt).put("subscriptionId", subscriptionId ?: -1)
        .put("source", source).put("confirmed", true)
}
