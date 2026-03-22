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
import {setMfaTempToken, setPendingEmail} from '@/store/authSlice';
import {Button} from '@/components/ui/Button';
import {TextInput} from '@/components/ui/TextInput';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  PAGE_HORIZONTAL_PADDING,
  SPACING,
} from '@/utils/constants';

type NavProp = NativeStackNavigationProp<AuthStackParamList>;

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export function LoginScreen() {
  const navigation = useNavigation<NavProp>();
  const dispatch = useAppDispatch();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {email: '', password: ''},
  });

  async function onSubmit(data: FormData) {
    setServerError(null);
    setIsLoading(true);
    try {
      const response = await authApi.login({
        email: data.email.trim().toLowerCase(),
        password: data.password,
      });
      dispatch(setMfaTempToken(response.data.temp_session_token));
      dispatch(setPendingEmail(data.email.trim().toLowerCase()));
      navigation.navigate('Mfa', {
        tempSessionToken: response.data.temp_session_token,
      });
    } catch (err) {
      const axiosErr = err as AxiosError<{detail?: string}>;
      if (axiosErr.response?.status === 401) {
        setServerError('Invalid email or password.');
      } else if (axiosErr.response?.status === 403) {
        setServerError('This account has been deleted.');
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
          <Text style={styles.logoEmoji}>🧠</Text>
          <Text style={[styles.title, {color: colors.textPrimary}]}>
            Welcome back
          </Text>
          <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
            Sign in to MindLift
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
                placeholder="Your password"
                secureTextEntry
                textContentType="password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
              />
            )}
          />
        </View>

        <TouchableOpacity
          style={styles.forgotLink}
          accessibilityRole="link"
          onPress={() => {
            // Forgot password — would navigate to a reset screen
          }}>
          <Text style={[styles.forgotText, {color: colors.primary}]}>
            Forgot password?
          </Text>
        </TouchableOpacity>

        <Button
          label="Sign in"
          onPress={handleSubmit(onSubmit)}
          loading={isLoading}
          style={styles.submitBtn}
        />

        <TouchableOpacity
          onPress={() => navigation.navigate('Register')}
          style={styles.registerLink}
          accessibilityRole="link">
          <Text style={[styles.registerLinkText, {color: colors.textSecondary}]}>
            Don't have an account?{' '}
            <Text style={{color: colors.primary, fontWeight: '600'}}>
              Create one
            </Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {
    padding: PAGE_HORIZONTAL_PADDING,
    paddingTop: 70,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxxl,
  },
  logoEmoji: {
    fontSize: 48,
    marginBottom: SPACING.sm,
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
  forgotLink: {
    alignSelf: 'flex-end',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  forgotText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
  },
  submitBtn: {
    marginTop: SPACING.xs,
  },
  registerLink: {
    marginTop: SPACING.xl,
    alignItems: 'center',
  },
  registerLinkText: {
    fontSize: FONT_SIZE.sm,
  },
});
