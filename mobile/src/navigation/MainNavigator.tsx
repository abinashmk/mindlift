import React, {useEffect} from 'react';
import {useColorScheme} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {MainStackParamList, MainTabParamList} from '@/types';
import {COLORS_DARK, COLORS_LIGHT} from '@/utils/constants';
import {useSessionGuard} from '@/hooks/useSessionGuard';
import {useAppDispatch} from '@/store';
import {setConsents} from '@/store/consentsSlice';
import {consentsApi} from '@/api/escalations';
import {TabBarIcon} from '@/components/ui/TabBarIcon';

import {HomeScreen} from '@/screens/main/HomeScreen';
import {InsightsScreen} from '@/screens/main/InsightsScreen';
import {ChatScreen} from '@/screens/main/ChatScreen';
import {SettingsScreen} from '@/screens/main/SettingsScreen';
import {InterventionsListScreen} from '@/screens/main/InterventionsListScreen';
import {InterventionDetailScreen} from '@/screens/main/InterventionDetailScreen';
import {CrisisScreen} from '@/screens/main/CrisisScreen';
import {ExportRequestedScreen} from '@/screens/account/ExportRequestedScreen';
import {DeletionRequestedScreen} from '@/screens/account/DeletionRequestedScreen';
import {ConsentUpdateScreen} from '@/screens/account/ConsentUpdateScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

function MainTabs() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          letterSpacing: 0.2,
          marginTop: 2,
        },
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({focused, color}) => (
            <TabBarIcon name="home" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{
          tabBarLabel: 'Insights',
          tabBarIcon: ({focused, color}) => (
            <TabBarIcon name="analytics" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({focused, color}) => (
            <TabBarIcon name="chatbubble" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({focused, color}) => (
            <TabBarIcon name="settings" focused={focused} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function MainNavigator() {
  // Enforces 30-minute idle timeout and biometric re-lock (spec §11.3, §11.5)
  useSessionGuard();

  const dispatch = useAppDispatch();

  // Sync consent flags from API on mount (covers app restart and new logins)
  useEffect(() => {
    consentsApi.getConsents().then(res => {
      const records: Array<{consent_key: string; consent_value: boolean}> = res.data as any;
      // Records are newest-first; take the first occurrence of each key
      const latest: Record<string, boolean> = {};
      for (const r of records) {
        if (!(r.consent_key in latest)) {
          latest[r.consent_key] = r.consent_value;
        }
      }
      dispatch(setConsents({
        health_data_accepted: latest.health_data_accepted ?? false,
        location_category_accepted: latest.location_category_accepted ?? false,
        noise_level_accepted: latest.noise_level_accepted ?? false,
        chat_logging_accepted: latest.chat_logging_accepted ?? true,
      }));
    }).catch(() => {
      // Keep existing store values on network failure
    });
  }, [dispatch]);

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="InterventionsList" component={InterventionsListScreen} />
      <Stack.Screen
        name="InterventionDetail"
        component={InterventionDetailScreen}
      />
      <Stack.Screen
        name="Crisis"
        component={CrisisScreen}
        options={{gestureEnabled: false}}
      />
      <Stack.Screen name="ConsentUpdate" component={ConsentUpdateScreen} />
      <Stack.Screen name="ExportRequested" component={ExportRequestedScreen} />
      <Stack.Screen
        name="DeletionRequested"
        component={DeletionRequestedScreen}
        options={{gestureEnabled: false}}
      />
    </Stack.Navigator>
  );
}
