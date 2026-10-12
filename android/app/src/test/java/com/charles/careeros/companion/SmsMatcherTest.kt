package com.charles.careeros.companion
import com.charles.careeros.companion.challenge.Challenge
import com.charles.careeros.companion.sms.SmsMatcher
import org.junit.Assert.*
import org.junit.Test
class SmsMatcherTest {
    private val challenge = Challenge("c", "desk", "phone", "test", "p", "o", "10690", "[Site]", 6, null, 1000, 121000)
    private fun extract(body: String, sender: String = "10690", receivedAt: Long = 2000, now: Long = 3000, subscriptionId: Int? = null, c: Challenge = challenge) = SmsMatcher.extract(c, sender, body, receivedAt, subscriptionId, now)
    @Test fun exactRuleExtractsCode() { assertEquals(listOf("123456"), extract("[Site] code 123456.")) }
    @Test fun longNumbersAreNeverSliced() { assertEquals(emptyList<String>(), extract("[Site] 1234567 0123456789")) }
    @Test fun multipleCandidatesRequireSelection() { assertEquals(listOf("123456", "654321"), extract("[Site] 123456 or 654321")) }
    @Test fun duplicateCodeIsDeduplicated() { assertEquals(listOf("123456"), extract("[Site] 123456 123456")) }
    @Test fun wrongSenderAndBodyFail() { assertTrue(extract("[Site] 123456", sender="unknown").isEmpty()); assertTrue(extract("other 123456").isEmpty()) }
    @Test fun oldFutureAndExpiredSmsFail() { assertTrue(extract("[Site] 123456", receivedAt=999).isEmpty()); assertTrue(extract("[Site] 123456", receivedAt=4000).isEmpty()); assertTrue(extract("[Site] 123456", now=121000).isEmpty()) }
    @Test fun subscriptionMustMatchWhenRestricted() { val c=challenge.copy(subscriptionId=2); assertTrue(extract("[Site] 123456", c=c).isEmpty()); assertTrue(extract("[Site] 123456", subscriptionId=1, c=c).isEmpty()); assertEquals(listOf("123456"), extract("[Site] 123456", subscriptionId=2, c=c)) }
    @Test fun staleServiceCenterTimestampRejectsFreshDelivery() {
        assertTrue(SmsMatcher.extract(challenge, "10690", "[Site] 123456", 2000, null, 3000, 999).isEmpty())
    }
    @Test fun serviceCenterSecondPrecisionIsAcceptedWithinCreationSecond() {
        assertEquals(listOf("123456"), SmsMatcher.extract(challenge.copy(createdAt=1500), "10690", "[Site] 123456", 2000, null, 3000, 1000))
    }
    @Test fun tenDigitConfiguredCodeIsAccepted() { assertEquals(listOf("1234567890"), extract("[Site] 1234567890", c=challenge.copy(codeLength=10))) }
    @Test fun completedRequestRejectsSms() { assertTrue(extract("[Site] 123456", c=challenge.copy(state="consumed")).isEmpty()) }
    @Test fun diagnosticsDistinguishSenderMarkerAndCarrierTimeWithoutEchoingInput() {
        assertEquals("SENDER_MISMATCH", SmsMatcher.evaluate(challenge, "other", "[Site] 482731", 2000, null, 3000).reason)
        assertEquals("MARKER_MISSING", SmsMatcher.evaluate(challenge, "10690", "other 482731", 2000, null, 3000).reason)
        assertEquals("SMS_BEFORE_REQUEST", SmsMatcher.evaluate(challenge, "10690", "[Site] 482731", 2000, null, 3000, 999).reason)
        assertEquals("SMS_IN_FUTURE", SmsMatcher.evaluate(challenge, "10690", "[Site] 482731", 2000, null, 3000, 4000).reason)
        assertEquals("CODE_NOT_FOUND", SmsMatcher.evaluate(challenge, "10690", "[Site] redacted", 2000, null, 3000).reason)
        val matched = SmsMatcher.evaluate(challenge, "10690", "[Site] 482731", 2000, null, 3000)
        assertEquals("MATCHED", matched.reason)
        assertEquals(listOf("482731"), matched.codes)
    }
    @Test fun explicitServiceNumberRuleSupportsChangingHuaweiSendersOnlyWithMatchingSignature() {
        val c = challenge.copy(sender="106", bodyMarker="【华为】", senderMatch="prefix")
        for (sender in listOf("106809645555654", "106853078000067", "+86106853078000067")) {
            assertEquals(listOf("482731"), extract("【华为】482731", sender=sender, c=c))
        }
        assertTrue(extract("【华为】482731", sender="13800000000", c=c).isEmpty())
        assertTrue(extract("其他网站 482731", sender="106853078000067", c=c).isEmpty())
        assertTrue(extract("【华为】482731", sender="106foo", c=c).isEmpty())
        assertTrue(extract("【华为】482731", sender="106853078000067", c=c.copy(senderMatch="exact")).isEmpty())
    }
}
