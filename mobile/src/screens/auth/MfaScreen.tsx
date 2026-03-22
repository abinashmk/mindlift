import React, {useRef, useState, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {AxiosError} from 'axios';

import {AuthStackParamList} from '@/types';
import {authApi} from '@/api/auth';
import {useAppDispatch, useAppSelector} from '@/store';
import {loginSuccess} from '@/store/authSlice';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  BORDER_RADIUS,
  PAGE_HORIZONTAL_PADDING,
  SPACING,
  MIN_TAPPABLE,
} from '@/utils/constants';

type Props = NativeStackScreenProps<AuthStackParamList, 'Mfa'>;

const OTP_LENGTH = 6;

export function MfaScreen({route, navigation}: Props) {
  const {tempSessionToken} = route.params;
  const dispatch = useAppDispatch();
  const storedTempToken = useAppSelector(state => state.auth.mfaTempToken);
  const token = tempSessionToken || storedTempToken || '';

  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));

  const submitOtp = useCallback(
    async (code: string) => {
      if (code.length < OTP_LENGTH) return;
      setError(null);
      setIsLoading(true);
      try {
        const response = await authApi.verifyMfa({
          temp_session_token: token,
          otp_code: code,
        });
        const {access_token, refresh_token, user_state, user_id, first_name} =
          response.data;
        dispatch(
          loginSuccess({
            accessToken: access_token,
            refreshToken: refresh_token,
            userId: user_id,
            userState: user_state,
            firstName: first_name,
          }),
        );
        // Navigation is handled by RootNavigator based on userState
      } catch (err) {
        const axiosErr = err as AxiosError<{detail?: string}>;
        if (axiosErr.response?.status === 401 || axiosErr.response?.status === 400) {
          setError('Invalid verification code. Please try again.');
        } else {
          setError('Something went wrong. Please try again.');
        }
        // Reset OTP boxes
        setOtp(Array(OTP_LENGTH).fill(''));
        inputs.current[0]?.focus();
      } finally {
        setIsLoading(false);
      }
    },
    [token, dispatch],
  );

  function handleChange(text: string, index: number) {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }

    const full = newOtp.join('');
    if (full.length === OTP_LENGTH && !newOtp.includes('')) {
      submitOtp(full);
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      inputs.current[index - 1]?.focus();
    }
  }

  return (
    <View style={[styles.screen, {backgroundColor: colors.background}]}>
      <View style={styles.content}>
        <Text style={styles.lockEmoji}>🔐</Text>
        <Text style={[styles.title, {color: colors.textPrimary}]}>
          Enter verification code
        </Text>
        <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
          Enter the 6-digit code sent to your authenticator app or email.
        </Text>

        {/* OTP boxes */}
        <View style={styles.otpRow}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={el => {
                inputs.current[index] = el;
              }}
              style={[
                styles.otpBox,
                {
                  borderColor:
                    error
                      ? colors.danger
                      : digit
                      ? colors.primary
                      : colors.border,
                  backgroundColor: colors.surface,
                  color: colors.textPrimary,
                },
              ]}
              value={digit}
              onChangeText={text => handleChange(text, index)}
              onKeyPress={({nativeEvent}) =>
                handleKeyPress(nativeEvent.key, index)
              }
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
              editable={!isLoading}
              accessibilityLabel={`OTP digit ${index + 1}`}
            />
          ))}
        </View>

        {isLoading && (
          <Text style={[styles.loadingText, {color: colors.textSecondary}]}>
            Verifying…
          </Text>
        )}

        {error ? (
          <Text style={[styles.errorText, {color: colors.danger}]}>
            {error}
          </Text>
        ) : null}

        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.backLink}
          accessibilityRole="link">
          <Text style={[styles.backText, {color: colors.primary}]}>
            ← Back to sign in
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
  lockEmoji: {
    fontSize: 48,
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    lineHeight: FONT_SIZE.md * 1.4,
    textAlign: 'center',
    marginBottom: SPACING.xxxl,
  },
  otpRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  otpBox: {
    width: MIN_TAPPABLE,
    height: MIN_TAPPABLE + 8,
    borderWidth: 2,
    borderRadius: BORDER_RADIUS.md,
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
  },
  loadingText: {
    fontSize: FONT_SIZE.sm,
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  backLink: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
  },
  backText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
  },
});
