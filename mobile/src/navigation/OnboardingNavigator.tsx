import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {OnboardingStackParamList} from '@/types';

import {OnboardingIntroScreen} from '@/screens/onboarding/OnboardingIntroScreen';
import {ConsentScreen} from '@/screens/onboarding/ConsentScreen';
import {PermissionSetupScreen} from '@/screens/onboarding/PermissionSetupScreen';
import {TrustedContactScreen} from '@/screens/onboarding/TrustedContactScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="OnboardingIntro"
      screenOptions={{headerShown: false}}>
      <Stack.Screen name="OnboardingIntro" component={OnboardingIntroScreen} />
      <Stack.Screen name="Consent" component={ConsentScreen} />
      <Stack.Screen name="PermissionSetup" component={PermissionSetupScreen} />
      <Stack.Screen name="TrustedContact" component={TrustedContactScreen} />
    </Stack.Navigator>
  );
}
