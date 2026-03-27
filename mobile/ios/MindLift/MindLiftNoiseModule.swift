import AVFoundation
import Foundation

/// Native bridge exposing a single ambient-noise dB(A) sample to the JS layer.
/// PRIVACY: records to /dev/null — no audio is ever written to disk or transmitted.
///
/// JS usage: NativeModules.MindLiftNoiseModule.sampleAmbientDb() → Promise<number | null>
@objc(MindLiftNoiseModule)
class MindLiftNoiseModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  private var recorder: AVAudioRecorder?

  @objc func sampleAmbientDb(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let session = AVAudioSession.sharedInstance()

    // Verify microphone permission before attempting to record.
    guard session.recordPermission == .granted else {
      resolve(NSNull())
      return
    }

    do {
      try session.setCategory(.record, mode: .measurement, options: .mixWithOthers)
      try session.setActive(true)

      // Route audio to /dev/null — no audio is ever persisted.
      let nullURL = URL(fileURLWithPath: "/dev/null")
      let settings: [String: Any] = [
        AVFormatIDKey: kAudioFormatAppleLossless,
        AVSampleRateKey: 44_100,
        AVNumberOfChannelsKey: 1,
      ]

      let rec = try AVAudioRecorder(url: nullURL, settings: settings)
      rec.isMeteringEnabled = true
      rec.record()
      self.recorder = rec

      // Sample for 1 second then return the average dBFS value.
      DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
        rec.updateMeters()
        // averagePower returns dBFS (negative values). Convert to approximate dB(A)
        // by adding a +39 dB offset (mid-range consumer microphone calibration).
        let dbfs = Double(rec.averagePower(forChannel: 0))
        rec.stop()
        self.recorder = nil
        try? session.setActive(false, options: .notifyOthersOnDeactivation)

        // Clamp to valid environmental range [0, 140] per spec §14.2.
        let dba = min(max(dbfs + 39.0, 0.0), 140.0)
        resolve(dba)
      }
    } catch {
      reject("NOISE_ERROR", error.localizedDescription, error)
    }
  }
}
