package com.charles.careeros.companion.transport

import java.util.concurrent.CompletableFuture
import java.util.concurrent.Executors

/** One in-flight operation per device/key; no queue behind unrelated offline devices. */
class DeviceWork : AutoCloseable {
    private val executor = Executors.newCachedThreadPool()
    private val inFlight = mutableMapOf<String, CompletableFuture<Unit>>()
    fun submit(key: String, action: () -> Unit): CompletableFuture<Unit> = synchronized(inFlight) {
        inFlight[key]?.let { return it }
        val result = CompletableFuture<Unit>()
        inFlight[key] = result
        executor.execute {
            var failure: Throwable? = null
            try { action() } catch (error: Throwable) { failure = error }
            synchronized(inFlight) { if (inFlight[key] === result) inFlight.remove(key) }
            if (failure == null) result.complete(Unit) else result.completeExceptionally(failure)
        }
        result
    }
    override fun close() { executor.shutdownNow() }
}
