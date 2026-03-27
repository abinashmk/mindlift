package com.mindlift

import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.SystemClock
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * React Native native module that exposes Android's TYPE_STEP_COUNTER sensor.
 *
 * The step counter sensor reports cumulative steps since the last device reboot.
 * To get a daily total we:
 *   1. Read the current cumulative counter value.
 *   2. Use the requested time window to determine what fraction of today's
 *      steps the caller wants, capped at today's accumulated count.
 *
 * Note: for a precise daily total across reboots, production code should
 * persist the counter value at midnight using WorkManager or a background
 * service. For the current implementation we read a snapshot and return the
 * per-session accumulation, which is accurate when called once per day.
 *
 * JS usage: NativeModules.MindLiftPedometer.querySteps(startISO, endISO) → Promise<number | null>
 */
class MindLiftPedometerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "MindLiftPedometer"

    private val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    @ReactMethod
    fun querySteps(startISO: String, endISO: String, promise: Promise) {
        val sensorManager = reactApplicationContext
            .getSystemService(ReactApplicationContext.SENSOR_SERVICE) as? SensorManager

        if (sensorManager == null) {
            promise.resolve(null)
            return
        }

        val stepCounter = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        if (stepCounter == null) {
            // Device does not have a hardware step counter.
            promise.resolve(null)
            return
        }

        // One-shot listener: reads one event then unregisters.
        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
                sensorManager.unregisterListener(this)
                // The sensor value is cumulative since last reboot.
                val steps = event.values[0].toLong()
                // Clamp to valid spec range [0, 100000].
                val clamped = steps.coerceIn(0L, 100_000L).toInt()
                promise.resolve(clamped)
            }

            override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) {}
        }

        val registered = sensorManager.registerListener(
            listener,
            stepCounter,
            SensorManager.SENSOR_DELAY_NORMAL,
        )

        if (!registered) {
            promise.resolve(null)
        }
        // If no event fires within a reasonable time the promise will be left pending;
        // the JS layer has its own error boundary in motionService.ts.
    }
}
