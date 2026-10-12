package com.charles.careeros.companion.pairing

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONArray

class CredentialVault(context: Context) {
    private val preferences = context.getSharedPreferences("paired_devices", Context.MODE_PRIVATE)
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true).build())
        }.generateKey()
    }
    @Synchronized fun read(): List<PairedDevice> {
        val stored = preferences.getString("encrypted", null) ?: return emptyList()
        val bytes = Base64.getDecoder().decode(stored)
        require(bytes.size > 28) { "凭据损坏" }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
        cipher.updateAAD(ALIAS.toByteArray())
        val plaintext = cipher.doFinal(bytes.copyOfRange(12, bytes.size))
        return try {
            val array = JSONArray(String(plaintext, Charsets.UTF_8))
            (0 until array.length()).map { PairedDevice.fromJson(array.getJSONObject(it)) }
        } finally { plaintext.fill(0) }
    }
    @Synchronized fun write(devices: List<PairedDevice>) {
        val plaintext = JSONArray().also { array -> devices.forEach { array.put(it.toJson()) } }.toString().toByteArray()
        try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, key())
            cipher.updateAAD(ALIAS.toByteArray())
            val encrypted = cipher.doFinal(plaintext)
            check(preferences.edit().putString("encrypted", Base64.getEncoder().encodeToString(cipher.iv + encrypted)).commit())
        } finally { plaintext.fill(0) }
    }
    companion object { private const val ALIAS = "careeros-pairing-v1" }
}
