package com.charles.careeros.companion
import com.charles.careeros.companion.pairing.PairingValidation
import org.junit.Test
class PairingValidationTest {
    @Test fun httpsEndpointAccepted() { PairingValidation.validateEndpoint("https://192.168.1.5:4739") }
    @Test(expected=IllegalArgumentException::class) fun httpRejected() { PairingValidation.validateEndpoint("http://192.168.1.5:4739") }
    @Test(expected=IllegalArgumentException::class) fun userInfoRejected() { PairingValidation.validateEndpoint("https://user:secret@example.com") }
    @Test(expected=IllegalArgumentException::class) fun pathRejected() { PairingValidation.validateEndpoint("https://example.com/evil") }
    @Test(expected=IllegalArgumentException::class) fun queryRejected() { PairingValidation.validateEndpoint("https://example.com?token=secret") }
}
