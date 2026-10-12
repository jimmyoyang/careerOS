package com.charles.careeros.companion.transport

import com.charles.careeros.companion.pairing.PairedDevice
import com.charles.careeros.companion.pairing.PairingPayload
import com.charles.careeros.companion.pairing.PairingValidation
import java.net.URL
import java.security.KeyStore
import java.security.MessageDigest
import java.security.cert.X509Certificate
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager
import org.json.JSONObject

class BridgeException(val status: Int, val code: String) : Exception("Bridge $status: $code")

class BridgeClient(private val baseUrl: String, certificateDer: String, private val token: String? = null) {
    constructor(device: PairedDevice) : this(device.baseUrl, device.certificateDer, device.token)
    private val socketFactory: javax.net.ssl.SSLSocketFactory
    init {
        PairingValidation.validateEndpoint(baseUrl)
        val certificate = PairingPayload.certificate(certificateDer)
        certificate.checkValidity()
        val store = KeyStore.getInstance(KeyStore.getDefaultType()).apply { load(null); setCertificateEntry("bridge", certificate) }
        val factory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm()).apply { init(store) }
        val platform = factory.trustManagers.filterIsInstance<X509TrustManager>().single()
        val pinned = object : X509TrustManager {
            override fun getAcceptedIssuers(): Array<X509Certificate> = platform.acceptedIssuers
            override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) = platform.checkClientTrusted(chain, authType)
            override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {
                platform.checkServerTrusted(chain, authType)
                require(chain.isNotEmpty() && MessageDigest.isEqual(chain[0].encoded, certificate.encoded)) { "证书不匹配" }
                chain[0].checkValidity()
            }
        }
        socketFactory = SSLContext.getInstance("TLS").apply { init(null, arrayOf(pinned), null) }.socketFactory
    }
    fun request(method: String, path: String, body: JSONObject? = null): JSONObject {
        require(path.startsWith("/v1/") && !path.contains('?') && !path.contains('#'))
        val connection = URL(baseUrl.trimEnd('/') + path).openConnection() as HttpsURLConnection
        connection.sslSocketFactory = socketFactory
        // Preserve the platform hostname verifier. A supplied certificate never bypasses name checks.
        connection.instanceFollowRedirects = false
        connection.connectTimeout = 8000
        connection.readTimeout = 8000
        connection.requestMethod = method
        connection.setRequestProperty("Accept", "application/json")
        token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
        try {
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                val bytes = body.toString().toByteArray(Charsets.UTF_8)
                connection.setFixedLengthStreamingMode(bytes.size)
                connection.outputStream.use { it.write(bytes) }
                bytes.fill(0)
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val bytes = stream?.use { input ->
                val output = java.io.ByteArrayOutputStream()
                val chunk = ByteArray(4096)
                while (output.size() <= 262144) {
                    val count = input.read(chunk, 0, minOf(chunk.size, 262145 - output.size()))
                    if (count < 0) break
                    output.write(chunk, 0, count)
                }
                output.toByteArray()
            } ?: ByteArray(0)
            require(bytes.size <= 262144) { "响应过大" }
            val json = try { JSONObject(String(bytes, Charsets.UTF_8)) } catch (_: Exception) { JSONObject() }
            if (status !in 200..299) {
                val code = json.optString("error").takeIf { it.matches(Regex("[A-Z_]{1,64}")) } ?: "HTTP_ERROR"
                throw BridgeException(status, code)
            }
            return json
        } finally { connection.disconnect() }
    }
}
