package com.charles.careeros.companion

import com.charles.careeros.companion.transport.DeviceWork
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import org.junit.Assert.*
import org.junit.Test

class DeviceWorkTest {
    @Test fun twoOfflineDevicesDoNotBlockOnlineRefreshOrConfirmation() {
        val release = CountDownLatch(1)
        val slowStarted = CountDownLatch(2)
        val onlineRefresh = CountDownLatch(1)
        val confirmation = CountDownLatch(1)
        DeviceWork().use { work ->
            try {
                work.submit("refresh:offline-a") { slowStarted.countDown(); release.await() }
                work.submit("refresh:offline-b") { slowStarted.countDown(); release.await() }
                work.submit("refresh:online") { onlineRefresh.countDown() }
                work.submit("confirm:online") { confirmation.countDown() }
                assertTrue("Online refresh must not wait for offline timeouts", onlineRefresh.await(1, TimeUnit.SECONDS))
                assertTrue(confirmation.await(1, TimeUnit.SECONDS))
                assertTrue(slowStarted.await(1, TimeUnit.SECONDS))
            } finally { release.countDown() }
        }
    }
    @Test fun repeatedPollForSameDeviceSharesOneInFlightRequest() {
        val release = CountDownLatch(1)
        val calls = AtomicInteger()
        DeviceWork().use { work ->
            try {
                val first = work.submit("refresh:desktop") { calls.incrementAndGet(); release.await() }
                repeat(50) { assertSame(first, work.submit("refresh:desktop") { calls.incrementAndGet() }) }
                release.countDown()
                first.get(1, TimeUnit.SECONDS)
                assertEquals(1, calls.get())
            } finally { release.countDown() }
        }
    }
}
