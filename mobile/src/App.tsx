import React from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {Provider} from 'react-redux';
import {store} from './store';
import {RootNavigator} from './navigation/RootNavigator';
import {registerSleepInferenceListener} from './services/inferredSleepService';

// Register once at app startup — idempotent
registerSleepInferenceListener();

export default function App() {
  const isDark = useColorScheme() === 'dark';

  return (
    <Provider store={store}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <RootNavigator />
    </Provider>
  );
}
