import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useForm, Controller} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {AxiosError} from 'axios';

import {AuthStackParamList} from '@/types';
import {authApi} from '@/api/auth';
import {useAppDispatch} from '@/store';
import {setPendingEmail} from '@/store/authSlice';
import {Button} from '@/components/ui/Button';
import {TextInput} from '@/components/ui/TextInput';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  PAGE_HORIZONTAL_PADDING,
  SPACING,
} from '@/utils/constants';
import {detectTimezone} from '@/utils/formatters';

type NavProp = NativeStackNavigationProp<AuthStackParamList>;

// ─── Password requirements ─────────────────────────────────────────────────────

const passwordSchema = z
  .string()
  .min(12, 'At least 12 characters')
  .regex(/[A-Z]/, 'One uppercase letter')
  .regex(/[a-z]/, 'One lowercase letter')
  .regex(/[0-9]/, 'One digit')
  .regex(/[^A-Za-z0-9]/, 'One special character');

const schema = z
  .object({
    email: z.string().email('Enter a valid email address'),
    password: passwordSchema,
    confirmPassword: z.string(),
    ageConfirmed: z
      .boolean()
      .refine(v => v === true, 'You must confirm you are 18 or older'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

// ─── Password requirement checklist ──────────────────────────────────────────

const REQUIREMENTS = [
  {label: 'At least 12 characters', test: (p: string) => p.length >= 12},
  {label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p)},
  {label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p)},
  {label: 'Number', test: (p: string) => /[0-9]/.test(p)},
  {label: 'Special character', test: (p: string) => /[^A-Za-z0-9]/.test(p)},
];

export function RegisterScreen() {
  const navigation = useNavigation<NavProp>();
  const dispatch = useAppDispatch();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: {errors},
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      ageConfirmed: false,
    },
  });

  const watchedPassword = watch('password', '');
  const watchedAge = watch('ageConfirmed', false);

  async function onSubmit(data: FormData) {
    setServerError(null);
    setIsLoading(true);
    try {
      await authApi.register({
        email: data.email.trim().toLowerCase(),
        password: data.password,
        age_confirmed_18_plus: data.ageConfirmed,
        timezone: detectTimezone(),
      });
      dispatch(setPendingEmail(data.email.trim().toLowerCase()));
      navigation.navigate('EmailVerification', {
        email: data.email.trim().toLowerCase(),
      });
    } catch (err) {
      const axiosErr = err as AxiosError<{detail?: string}>;
      if (axiosErr.response?.status === 409) {
        setServerError('An account with this email already exists.');
      } else if (axiosErr.response?.status === 422) {
        const detail = axiosErr.response.data?.detail;
        setServerError(
          typeof detail === 'string' ? detail : 'Please check your information and try again.',
        );
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{flex: 1}}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={[styles.screen, {backgroundColor: colors.background}]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, {color: colors.textPrimary}]}>
            Create account
          </Text>
          <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
            Start your wellness journey
          </Text>
        </View>

        {serverError ? (
          <View
            style={[
              styles.errorBanner,
              {backgroundColor: colors.dangerLight, borderColor: colors.danger},
            ]}>
            <Text style={[styles.errorBannerText, {color: colors.danger}]}>
              {serverError}
            </Text>
          </View>
        ) : null}

        {/* Form */}
        <View style={styles.form}>
          <Controller
            control={control}
            name="email"
            render={({field: {onChange, onBlur, value}}) => (
              <TextInput
                label="Email address"
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({field: {onChange, onBlur, value}}) => (
              <TextInput
                label="Password"
                placeholder="Create a strong password"
                secureTextEntry
                textContentType="newPassword"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
              />
            )}
          />

          {/* Password requirements checklist */}
          <View
            style={[
              styles.requirementsList,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: 10,
              },
            ]}>
            {REQUIREMENTS.map(req => {
              const met = req.test(watchedPassword);
              return (
                <View key={req.label} style={styles.requirementRow}>
                  <Text
                    style={[
                      styles.requirementIcon,
                      {color: met ? colors.success : colors.textTertiary},
                    ]}>
                    {met ? '✓' : '○'}
                  </Text>
                  <Text
                    style={[
                      styles.requirementText,
                      {
                        color: met ? colors.success : colors.textSecondary,
                      },
                    ]}>
                    {req.label}
                  </Text>
                </View>
              );
            })}
          </View>

          <Controller
            control={control}
            name="confirmPassword"
            render={({field: {onChange, onBlur, value}}) => (
              <TextInput
                label="Confirm password"
                placeholder="Repeat your password"
                secureTextEntry
                textContentType="newPassword"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.confirmPassword?.message}
              />
            )}
          />

          {/* Age gate */}
          <Controller
            control={control}
            name="ageConfirmed"
            render={({field: {onChange, value}}) => (
              <TouchableOpacity
                style={styles.ageRow}
                onPress={() => onChange(!value)}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityLabel="I confirm I am 18 or older"
                accessibilityState={{checked: value}}>
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: errors.ageConfirmed
                        ? colors.danger
                        : colors.primary,
                      backgroundColor: value ? colors.primary : 'transparent',
                    },
                  ]}>
                  {value && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
                <Text style={[styles.ageText, {color: colors.textPrimary}]}>
                  I confirm I am 18 or older
                </Text>
              </TouchableOpacity>
            )}
          />
          {errors.ageConfirmed && (
            <Text style={[styles.fieldError, {color: colors.danger}]}>
              {errors.ageConfirmed.message}
            </Text>
          )}
        </View>

        <Button
          label="Create account"
          onPress={handleSubmit(onSubmit)}
          loading={isLoading}
          disabled={!watchedAge}
          style={styles.submitBtn}
        />

        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.loginLink}
          accessibilityRole="link">
          <Text style={[styles.loginLinkText, {color: colors.textSecondary}]}>
            Already have an account?{' '}
            <Text style={{color: colors.primary, fontWeight: '600'}}>
              Sign in
            </Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: PAGE_HORIZONTAL_PADDING,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
  },
  errorBanner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorBannerText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
  },
  form: {
    gap: 0,
  },
  requirementsList: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  requirementIcon: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    width: 16,
    textAlign: 'center',
  },
  requirementText: {
    fontSize: FONT_SIZE.sm,
  },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  ageText: {
    fontSize: FONT_SIZE.md,
    flex: 1,
  },
  fieldError: {
    fontSize: FONT_SIZE.xs,
    marginBottom: SPACING.sm,
    marginTop: -SPACING.xs,
    fontWeight: '500',
  },
  submitBtn: {
    marginTop: SPACING.md,
  },
  loginLink: {
    marginTop: SPACING.xl,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: FONT_SIZE.sm,
  },
});
