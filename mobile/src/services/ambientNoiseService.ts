/**
 * Ambient noise level service — stub implementation.
 *
 * Exposes a single `getAmbientNoiseLevel` function that returns a dB(A)
 * aggregate value for the current environment, or null when unavailable.
 *
 * PRIVACY NOTE: This service returns ONLY an aggregated decibel value.
 * No raw audio buffers are ever stored, transmitted, or retained.
 * The privacy contract is enforced at the native layer (see setup notes below).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Full native implementation requires the following platform work:
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * iOS — AVFoundation (AVAudioRecorder metering):
 *   1. Create ios/MindLiftNoiseModule.swift:
 *        import AVFoundation
 *        @objc(MindLiftNoiseModule)
 *        class MindLiftNoiseModule: NSObject {
 *          private var recorder: AVAudioRecorder?
 *          @objc func sampleAmbientDb(_ resolver: @escaping RCTPromiseResolveBlock,
 *                                     rejecter: @escaping RCTPromiseRejectBlock) {
 *            let settings: [String: Any] = [
 *              AVFormatIDKey: kAudioFormatAppleLossless,
 *              AVSampleRateKey: 44100,
 *              AVNumberOfChannelsKey: 1,
 *            ]
 *            let url = URL(fileURLWithPath: "/dev/null")   // never write audio to disk
 *            recorder = try? AVAudioRecorder(url: url, settings: settings)
 *            recorder?.isMeteringEnabled = true
 *            recorder?.record()
 *            // Sample for ~1 second then stop
 *            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
 *              self.recorder?.updateMeters()
 *              let db = self.recorder?.averagePower(forChannel: 0) ?? -160
 *              self.recorder?.stop()
 *              self.recorder = nil
 *              resolver(db)  // returns Float dBFS, caller converts to dB(A)
 *            }
 *          }
 *        }
 *   2. Register via RCT_EXTERN_MODULE or Swift @objc bridging header.
 *   3. Add NSMicrophoneUsageDescription to Info.plist.
 *   4. Microphone permission must be granted (permissionService.requestMicrophone()).
 *
 * Android — AudioRecord:
 *   1. Create android/app/src/main/java/.../MindLiftNoiseModule.kt:
 *        class MindLiftNoiseModule(reactContext: ReactApplicationContext)
 *          : ReactContextBaseJavaModule(reactContext) {
 *          @ReactMethod
 *          fun sampleAmbientDb(promise: Promise) {
 *            val sampleRate = 44100
 *            val bufSize = AudioRecord.getMinBufferSize(
 *              sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
 *            val recorder = AudioRecord(MediaRecorder.AudioSource.MIC,
 *              sampleRate, AudioFormat.CHANNEL_IN_MONO,
 *              AudioFormat.ENCODING_PCM_16BIT, bufSize)
 *            recorder.startRecording()
 *            val buffer = ShortArray(bufSize)
 *            recorder.read(buffer, 0, bufSize)   // single chunk, ~1s
 *            recorder.stop(); recorder.release()
 *            // Compute RMS amplitude → dBFS, apply A-weighting offset (~+39 dB)
 *            val rms = sqrt(buffer.map { it * it.toDouble() }.average())
 *            val dbfs = if (rms > 0) 20 * log10(rms / Short.MAX_VALUE) else -160.0
 *            val dba = dbfs + 39.0
 *            promise.resolve(dba)
 *          }
 *        }
 *   2. Register in a ReactPackage and add to MainApplication.
 *   3. RECORD_AUDIO permission must be granted (permissionService.requestMicrophone()).
 *
 * Until the native modules above are implemented, this service returns null.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {NativeModules} from 'react-native';
import {validateRange} from '@/utils/validators';

interface MindLiftNoiseModule {
  sampleAmbientDb(): Promise<number>;
}

function getNativeModule(): MindLiftNoiseModule | null {
  const mod = NativeModules.MindLiftNoiseModule as MindLiftNoiseModule | undefined;
  return mod ?? null;
}

/**
 * Sample the current ambient noise level and return a dB(A) aggregate.
 *
 * Returns null when:
 * - The native module has not been linked (see setup notes above)
 * - Microphone permission is denied
 * - The reading is outside the valid environmental range (0–140 dB)
 * - Any other error occurs
 *
 * PRIVACY: Only a single aggregate dB value is returned. No audio is stored.
 */
export async function getAmbientNoiseLevel(): Promise<number | null> {
  const nativeModule = getNativeModule();
  if (!nativeModule) {
    // Native module not linked yet — see setup notes in this file's header
    return null;
  }

  try {
    const db = await nativeModule.sampleAmbientDb();
    // Environmental dB(A) range: 0 dB (threshold of hearing) to ~140 dB (pain threshold)
    return validateRange(db, 0, 140);
  } catch (err) {
    console.warn('[ambientNoiseService] Failed to sample ambient noise:', err);
    return null;
  }
}
