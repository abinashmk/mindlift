import React, {useEffect, useRef, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
} from 'react-native';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {AuthStackParamList} from '@/types';
import {authApi} from '@/api/auth';
import {Button} from '@/components/ui/Button';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  PAGE_HORIZONTAL_PADDING,
  SPACING,
} from '@/utils/constants';

type Props = NativeStackScreenProps<AuthStackParamList, 'EmailVerification'>;
type NavProp = NativeStackNavigationProp<AuthStackParamList>;

const POLL_INTERVAL_MS = 10_000;

export function EmailVerificationScreen({route}: Props) {
  const {email} = route.params;
  const navigation = useNavigation<NavProp>();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkVerification = useCallback(async () => {
    try {
      const res = await authApi.checkVerificationStatus(email);
      if (res.data.verified) {
        if (pollRef.current) clearInterval(pollRef.current);
        navigation.navigate('Mfa', {tempSessionToken: ''});
        // In practice the verification would redirect to OnboardingIntro directly
        // via the server; here we navigate to Onboarding
      }
    } catch {
      // Silent — keep polling
    }
  }, [email, navigation]);

  useEffect(() => {
    // Start polling
    pollRef.current = setInterval(checkVerification, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [checkVerification]);

  async function handleResend() {
    setResendLoading(true);
    setStatusMessage(null);
    try {
      await authApi.resendVerificationEmail(email);
      setResendSent(true);
      setStatusMessage('Verification email sent. Check your inbox.');
    } catch {
      setStatusMessage('Failed to resend email. Please try again.');
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <View style={[styles.screen, {backgroundColor: colors.background}]}>
      <View style={styles.content}>
        <Text style={styles.envelope}>✉️</Text>
        <Text style={[styles.title, {color: colors.textPrimary}]}>
          Check your email
        </Text>
        <Text style={[styles.body, {color: colors.textSecondary}]}>
          We sent a verification link to{' '}
          <Text style={{color: colors.primary, fontWeight: '600'}}>{email}</Text>
          .{'\n\n'}
          Click the link in the email to verify your account. This page will
          update automatically.
        </Text>

        {statusMessage ? (
          <View
            style={[
              styles.statusBanner,
              {
                backgroundColor: resendSent
                  ? colors.successLight
                  : colors.dangerLight,
              },
            ]}>
            <Text
              style={{
                color: resendSent ? colors.success : colors.danger,
                fontSize: FONT_SIZE.sm,
                fontWeight: '500',
              }}>
              {statusMessage}
            </Text>
          </View>
        ) : null}

        <Button
          label={resendLoading ? 'Sending…' : 'Resend email'}
          onPress={handleResend}
          loading={resendLoading}
          variant="outline"
          style={styles.resendBtn}
        />

        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.backLink}
          accessibilityRole="link">
          <Text style={[styles.backText, {color: colors.textSecondary}]}>
            Back to{' '}
            <Text style={{color: colors.primary, fontWeight: '600'}}>
              Sign in
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {
    flex: 1,
    padding: PAGE_HORIZONTAL_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  envelope: {
    fontSize: 56,
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  body: {
    fontSize: FONT_SIZE.md,
    lineHeight: FONT_SIZE.md * 1.4,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  statusBanner: {
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    width: '100%',
    alignItems: 'center',
  },
  resendBtn: {
    width: '100%',
    marginBottom: SPACING.xl,
  },
  backLink: {
    padding: SPACING.sm,
  },
  backText: {
    fontSize: FONT_SIZE.sm,
  },
});
