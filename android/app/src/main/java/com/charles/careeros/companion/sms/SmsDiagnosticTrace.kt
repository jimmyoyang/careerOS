package com.charles.careeros.companion.sms

// Session serializes access under its lock. Late network work must not label a newer SMS.
class SmsDiagnosticTrace {
    private var sequence = 0L
    private val values = mutableSetOf<String>()
    val reasons: Set<String> get() = values.toSet()
    fun begin(): Long { values.clear(); return ++sequence }
    fun record(id: Long, reason: String) { if (id == sequence) values.add(reason) }
    fun recordCurrent(reason: String) { values.add(reason) }
}
