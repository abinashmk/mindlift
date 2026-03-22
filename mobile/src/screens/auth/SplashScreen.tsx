import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {RootStackParamList} from '@/types';
import {useAppSelector} from '@/store';
import {COLORS_DARK, COLORS_LIGHT, FONT_SIZE} from '@/utils/constants';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export function SplashScreen() {
  const navigation = useNavigation<NavProp>();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;
  const {isAuthenticated, userState} = useAppSelector(state => state.auth);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isAuthenticated) {
        navigation.replace('Auth');
      } else if (userState === 'ONBOARDING') {
        navigation.replace('Onboarding');
      } else if (
        userState === 'ACTIVE' ||
        userState === 'LIMITED' ||
        userState === 'CRISIS' ||
        userState === 'ESCALATED'
      ) {
        navigation.replace('Main');
      } else {
        // Deleted or unknown state — send to Auth
        navigation.replace('Auth');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, userState, navigation]);

  return (
    <View
      style={[styles.container, {backgroundColor: colors.background}]}
      accessibilityLabel="Loading MindLift">
      <View style={styles.logoContainer}>
        <Text style={styles.logoEmoji}>🧠</Text>
        <Text style={[styles.appName, {color: colors.textPrimary}]}>
          MindLift
        </Text>
        <Text style={[styles.tagline, {color: colors.textSecondary}]}>
          Your mental wellness companion
        </Text>
      </View>
      <ActivityIndicator
        color={colors.primary}
        size="small"
        style={styles.spinner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    gap: 8,
  },
  logoEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  appName: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: FONT_SIZE.md,
    fontWeight: '400',
  },
  spinner: {
    position: 'absolute',
    bottom: 80,
  },
});
