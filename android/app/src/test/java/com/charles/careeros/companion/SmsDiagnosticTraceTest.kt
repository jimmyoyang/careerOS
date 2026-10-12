package com.charles.careeros.companion

import com.charles.careeros.companion.sms.SmsDiagnosticTrace
import org.junit.Assert.assertEquals
import org.junit.Test

class SmsDiagnosticTraceTest {
    @Test fun lateOldSmsResultCannotChangeNewestSmsDiagnosis() {
        val trace = SmsDiagnosticTrace()
        val old = trace.begin()
        val current = trace.begin()
        trace.record(current, "SENDER_MISMATCH")
        trace.record(old, "MATCHED")
        assertEquals(setOf("SENDER_MISMATCH"), trace.reasons)
    }
    @Test fun startingNewSmsClearsPreviousResults() {
        val trace = SmsDiagnosticTrace()
        trace.record(trace.begin(), "MATCHED")
        trace.begin()
        assertEquals(emptySet<String>(), trace.reasons)
    }
}
