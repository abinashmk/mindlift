import React from 'react';
import {useColorScheme, Text} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {MainStackParamList, MainTabParamList} from '@/types';
import {COLORS_DARK, COLORS_LIGHT} from '@/utils/constants';

import {HomeScreen} from '@/screens/main/HomeScreen';
import {InsightsScreen} from '@/screens/main/InsightsScreen';
import {ChatScreen} from '@/screens/main/ChatScreen';
import {SettingsScreen} from '@/screens/main/SettingsScreen';
import {InterventionsListScreen} from '@/screens/main/InterventionsListScreen';
import {InterventionDetailScreen} from '@/screens/main/InterventionDetailScreen';
import {CrisisScreen} from '@/screens/main/CrisisScreen';
import {ExportRequestedScreen} from '@/screens/account/ExportRequestedScreen';
import {DeletionRequestedScreen} from '@/screens/account/DeletionRequestedScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

function TabIcon({emoji, focused}: {emoji: string; focused: boolean}) {
  return (
    <Text style={{fontSize: focused ? 24 : 20, opacity: focused ? 1 : 0.6}}>
      {emoji}
    </Text>
  );
}

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
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {fontSize: 11, fontWeight: '500'},
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({focused}) => (
            <TabIcon emoji="🏠" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{
          tabBarLabel: 'Insights',
          tabBarIcon: ({focused}) => (
            <TabIcon emoji="📊" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({focused}) => (
            <TabIcon emoji="💬" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({focused}) => (
            <TabIcon emoji="⚙️" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function MainNavigator() {
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
      <Stack.Screen name="ExportRequested" component={ExportRequestedScreen} />
      <Stack.Screen
        name="DeletionRequested"
        component={DeletionRequestedScreen}
        options={{gestureEnabled: false}}
      />
    </Stack.Navigator>
  );
}
