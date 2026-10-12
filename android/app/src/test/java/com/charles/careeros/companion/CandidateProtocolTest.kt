package com.charles.careeros.companion
import com.charles.careeros.companion.challenge.Candidate
import org.junit.Assert.*
import org.junit.Test
class CandidateProtocolTest {
    @Test fun missingSubscriptionUsesProtocolSentinel() {
        val candidate = Candidate("c", "d", "123456", "sender", "marker", 1000, null, "manual")
        assertEquals(-1, candidate.toJson().optInt("subscriptionId", -99))
    }
    @Test fun knownSubscriptionIsPreserved() {
        val candidate = Candidate("c", "d", "123456", "sender", "marker", 1000, 2, "sms")
        assertEquals(2, candidate.toJson().getInt("subscriptionId"))
    }
}
