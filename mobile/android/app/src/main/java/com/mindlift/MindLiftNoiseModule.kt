package com.mindlift

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlin.math.log10
import kotlin.math.sqrt

/**
 * React Native native module that samples the current ambient noise level.
 *
 * PRIVACY: Records a single short buffer from the microphone, computes an
 * RMS amplitude, converts to dBFS, then immediately releases the AudioRecord.
 * No audio data is stored, transmitted, or retained beyond this calculation.
 *
 * JS usage: NativeModules.MindLiftNoiseModule.sampleAmbientDb() → Promise<number | null>
 */
class MindLiftNoiseModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "MindLiftNoiseModule"

    @ReactMethod
    fun sampleAmbientDb(promise: Promise) {
        val sampleRate = 44_100
        val channelConfig = AudioFormat.CHANNEL_IN_MONO
        val encoding = AudioFormat.ENCODING_PCM_16BIT
        val minBuffer = AudioRecord.getMinBufferSize(sampleRate, channelConfig, encoding)

        if (minBuffer == AudioRecord.ERROR || minBuffer == AudioRecord.ERROR_BAD_VALUE) {
            promise.resolve(null)
            return
        }

        val recorder = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            sampleRate,
            channelConfig,
            encoding,
            minBuffer,
        )

        if (recorder.state != AudioRecord.STATE_INITIALIZED) {
            recorder.release()
            promise.resolve(null)
            return
        }

        try {
            recorder.startRecording()
            val buffer = ShortArray(minBuffer)
            val read = recorder.read(buffer, 0, minBuffer)
            recorder.stop()

            if (read <= 0) {
                promise.resolve(null)
                return
            }

            // RMS amplitude of the buffer
            val rms = sqrt(buffer.take(read).map { it.toDouble() * it.toDouble() }.average())

            // Convert to dBFS, then apply +39 dB offset to approximate dB(A)
            val dbfs = if (rms > 0.0) 20.0 * log10(rms / Short.MAX_VALUE) else -160.0
            val dba = dbfs + 39.0

            // Clamp to valid environmental range [0.0, 140.0] per spec §14.2
            val clamped = dba.coerceIn(0.0, 140.0)
            promise.resolve(clamped)
        } catch (e: Exception) {
            promise.reject("NOISE_ERROR", e.message, e)
        } finally {
            recorder.release()
        }
    }
}
