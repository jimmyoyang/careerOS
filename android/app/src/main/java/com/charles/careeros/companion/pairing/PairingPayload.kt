package com.charles.careeros.companion.pairing

import java.net.URI
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.util.Base64
import org.json.JSONObject

object PairingValidation {
    fun validateEndpoint(baseUrl: String) {
        val uri = try { URI(baseUrl) } catch (_: Exception) { throw IllegalArgumentException("配对地址无效") }
        require(uri.scheme == "https" && !uri.host.isNullOrBlank() && uri.rawUserInfo == null &&
            (uri.rawPath.isNullOrEmpty() || uri.rawPath == "/") && uri.rawQuery == null && uri.rawFragment == null &&
            uri.port in -1..65535 && uri.port != 0) { "仅接受 HTTPS 服务地址，不能带路径或账号" }
    }
}

class PairingPayload(val baseUrl: String, val certificateDer: String, val pairingId: String,
                     val secret: String, val desktopId: String, val confirmationCode: String, val expiresAt: Long) {
    companion object {
        fun parse(text: String, now: Long = System.currentTimeMillis()): PairingPayload {
            require(text.length in 1..32768) { "配对文本长度无效" }
            val json = JSONObject(text)
            val baseUrl = json.getString("baseUrl").trimEnd('/')
            PairingValidation.validateEndpoint(baseUrl)
            val expiresAt = json.getLong("expiresAt")
            require(expiresAt > now && expiresAt <= now + 180000) { "配对已过期或时间不正确" }
            val der = json.getString("certificateDer")
            certificate(der).checkValidity()
            fun field(key: String): String = json.getString(key).also { require(it.length in 1..512) { "配对字段无效" } }
            return PairingPayload(baseUrl, der, field("pairingId"), field("secret"), field("desktopId"), field("confirmationCode"), expiresAt)
        }
        fun certificate(der: String): X509Certificate {
            require(der.length in 1..16384) { "证书长度无效" }
            return CertificateFactory.getInstance("X.509").generateCertificate(Base64.getDecoder().decode(der).inputStream()) as X509Certificate
        }
    }
}

class PairedDevice(val deviceId: String, val token: String, val desktopId: String, val name: String,
                   val baseUrl: String, val certificateDer: String, val confirmationCode: String, var active: Boolean = false) {
    fun toJson(): JSONObject = JSONObject().put("deviceId", deviceId).put("token", token).put("desktopId", desktopId)
        .put("name", name).put("baseUrl", baseUrl).put("certificateDer", certificateDer)
        .put("confirmationCode", confirmationCode).put("active", active)
    companion object {
        fun fromJson(json: JSONObject) = PairedDevice(json.getString("deviceId"), json.getString("token"),
            json.getString("desktopId"), json.getString("name"), json.getString("baseUrl"),
            json.getString("certificateDer"), json.getString("confirmationCode"), json.optBoolean("active"))
    }
}
