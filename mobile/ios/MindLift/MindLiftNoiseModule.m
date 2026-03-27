#import <React/RCTBridgeModule.h>

RCT_EXTERN_MODULE(MindLiftNoiseModule, NSObject)

RCT_EXTERN_METHOD(
  sampleAmbientDb:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)
