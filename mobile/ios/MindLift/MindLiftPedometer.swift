import CoreMotion
import Foundation

/// Native bridge exposing CMPedometer to the React Native JS layer.
/// JS usage: NativeModules.MindLiftPedometer.querySteps(startISO, endISO) → Promise<number>
@objc(MindLiftPedometer)
class MindLiftPedometer: NSObject {

  private let pedometer = CMPedometer()

  /// Returns whether the device hardware supports step counting.
  @objc static func requiresMainQueueSetup() -> Bool { false }

  /// Query the total step count between two ISO-8601 timestamps.
  ///
  /// - Parameters:
  ///   - startISO: Start of the interval (e.g. "2026-03-22T00:00:00.000Z")
  ///   - endISO:   End of the interval   (e.g. "2026-03-22T23:59:59.999Z")
  ///   - resolve:  Resolves with an integer step count, or 0 if unavailable.
  ///   - reject:   Rejects with an error code and message on failure.
  @objc func querySteps(
    _ startISO: String,
    endISO: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard CMPedometer.isStepCountingAvailable() else {
      resolve(NSNull())
      return
    }

    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

    guard
      let start = formatter.date(from: startISO),
      let end = formatter.date(from: endISO)
    else {
      reject("INVALID_DATE", "Could not parse date strings: \(startISO), \(endISO)", nil)
      return
    }

    pedometer.queryPedometerData(from: start, to: end) { data, error in
      if let error = error {
        reject("PEDOMETER_ERROR", error.localizedDescription, error)
        return
      }
      let steps = data?.numberOfSteps.intValue ?? 0
      resolve(steps)
    }
  }
}
