import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ScrollView,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {OnboardingStackParamList} from '@/types';
import {Button} from '@/components/ui/Button';
import {
  CLINICAL_DISCLOSURE,
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  PAGE_HORIZONTAL_PADDING,
  SPACING,
} from '@/utils/constants';

type NavProp = NativeStackNavigationProp<OnboardingStackParamList>;

const FEATURES = [
  {emoji: '📊', label: 'Track daily mood and activity'},
  {emoji: '🧘', label: 'Receive personalized wellness suggestions'},
  {emoji: '💬', label: 'Chat with an AI support companion'},
  {emoji: '🔒', label: 'Your data stays private and secure'},
];

export function OnboardingIntroScreen() {
  const navigation = useNavigation<NavProp>();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  return (
    <ScrollView
      style={[styles.screen, {backgroundColor: colors.background}]}
      contentContainerStyle={styles.content}>
      {/* Logo */}
      <View style={styles.logoSection}>
        <Text style={styles.logoEmoji}>🧠</Text>
        <Text style={[styles.appName, {color: colors.textPrimary}]}>
          MindLift
        </Text>
        <Text style={[styles.tagline, {color: colors.textSecondary}]}>
          Self-monitoring for mental wellness
        </Text>
      </View>

      {/* Description */}
      <Text style={[styles.description, {color: colors.textPrimary}]}>
        MindLift helps you understand patterns in your daily life that may
        affect your mental wellbeing — gently, privately, and without clinical
        judgment.
      </Text>

      {/* Feature list */}
      <View style={styles.features}>
        {FEATURES.map(f => (
          <View key={f.label} style={styles.featureRow}>
            <Text style={styles.featureEmoji}>{f.emoji}</Text>
            <Text style={[styles.featureText, {color: colors.textPrimary}]}>
              {f.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Exact disclosure from spec */}
      <View
        style={[
          styles.disclosureBox,
          {
            backgroundColor: colors.surfaceSecondary,
            borderLeftColor: colors.primary,
          },
        ]}>
        <Text style={[styles.disclosureText, {color: colors.textSecondary}]}>
          {CLINICAL_DISCLOSURE}
        </Text>
      </View>

      <Button
        label="Get Started"
        onPress={() => navigation.navigate('Consent')}
        style={styles.ctaBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {
    padding: PAGE_HORIZONTAL_PADDING,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: SPACING.xxxl,
  },
  logoEmoji: {
    fontSize: 64,
    marginBottom: SPACING.sm,
  },
  appName: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  tagline: {
    fontSize: FONT_SIZE.md,
  },
  description: {
    fontSize: FONT_SIZE.md,
    lineHeight: FONT_SIZE.md * 1.4,
    marginBottom: SPACING.xl,
  },
  features: {
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  featureEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  featureText: {
    fontSize: FONT_SIZE.md,
    flex: 1,
  },
  disclosureBox: {
    borderLeftWidth: 3,
    paddingLeft: SPACING.md,
    paddingVertical: SPACING.md,
    paddingRight: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.xl,
  },
  disclosureText: {
    fontSize: FONT_SIZE.sm,
    lineHeight: FONT_SIZE.sm * 1.4,
    fontStyle: 'italic',
  },
  ctaBtn: {
    marginTop: SPACING.sm,
  },
});
