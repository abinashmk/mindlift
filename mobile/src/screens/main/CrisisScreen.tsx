import React, {useEffect, useState} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  useColorScheme,
  BackHandler,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {MainStackParamList} from '@/types';
import {escalationsApi} from '@/api/escalations';
import {chatApi} from '@/api/chat';
import {useAppSelector} from '@/store';
import {CrisisMessage} from '@/components/CrisisMessage';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  PAGE_HORIZONTAL_PADDING,
} from '@/utils/constants';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

export function CrisisScreen() {
  const navigation = useNavigation<NavProp>();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const sessionId = useAppSelector(state => state.chat.sessionId);
  const [hasTrustedContact, setHasTrustedContact] = useState(false);

  // Disable Android back button
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        // Block back navigation from crisis screen
        return true;
      },
    );
    return () => subscription.remove();
  }, []);

  // Disable gesture-based back (done in navigator options)

  // Check trusted contact
  useEffect(() => {
    async function checkContacts() {
      try {
        const res = await escalationsApi.getEscalationContacts();
        setHasTrustedContact(res.data.length > 0);
      } catch {
        setHasTrustedContact(false);
      }
    }
    checkContacts();
  }, []);

  async function handleMessageSupport() {
    try {
      await chatApi.manualEscalation(sessionId, 'User used crisis screen — message support');
    } catch {
      // Non-critical
    }
    // Navigate to home with a note — do not go back to chat
    navigation.reset({
      index: 0,
      routes: [{name: 'MainTabs'}],
    });
  }

  return (
    <View style={[styles.screen, {backgroundColor: colors.background}]}>
      <ScrollView contentContainerStyle={styles.content}>
        <CrisisMessage
          hasTrustedContact={hasTrustedContact}
          onMessageSupport={handleMessageSupport}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: PAGE_HORIZONTAL_PADDING,
    paddingTop: 80,
    paddingBottom: 60,
  },
});
