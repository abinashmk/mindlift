import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useAppSelector} from '@/store';
import {RootStackParamList} from '@/types';

import {SplashScreen} from '@/screens/auth/SplashScreen';
import {AuthNavigator} from './AuthNavigator';
import {OnboardingNavigator} from './OnboardingNavigator';
import {MainNavigator} from './MainNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const {isAuthenticated, userState} = useAppSelector(state => state.auth);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        {/* Splash is always available for initial routing */}
        <Stack.Screen name="Splash" component={SplashScreen} />

        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : userState === 'ONBOARDING' ? (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : (
          <Stack.Screen name="Main" component={MainNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
