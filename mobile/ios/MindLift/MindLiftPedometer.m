#import <React/RCTBridgeModule.h>

// Registers MindLiftPedometer with the React Native bridge so it appears
// in NativeModules.MindLiftPedometer on the JS side.
RCT_EXTERN_MODULE(MindLiftPedometer, NSObject)

RCT_EXTERN_METHOD(
  querySteps:(NSString *)startISO
  endISO:(NSString *)endISO
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)
