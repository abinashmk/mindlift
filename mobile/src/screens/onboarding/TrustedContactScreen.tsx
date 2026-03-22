import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
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

import {OnboardingStackParamList} from '@/types';
import {escalationsApi} from '@/api/escalations';
import {useAppDispatch} from '@/store';
import {updateUserState} from '@/store/authSlice';
import {Button} from '@/components/ui/Button';
import {TextInput} from '@/components/ui/TextInput';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  PAGE_HORIZONTAL_PADDING,
  SPACING,
} from '@/utils/constants';

type NavProp = NativeStackNavigationProp<OnboardingStackParamList>;

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z
    .string()
    .min(10, 'Enter a valid phone number')
    .regex(/^[+\d\s\-().]+$/, 'Enter a valid phone number'),
  relationship: z.string().min(1, 'Please enter a relationship'),
});

type FormData = z.infer<typeof schema>;

export function TrustedContactScreen() {
  const navigation = useNavigation<NavProp>();
  const dispatch = useAppDispatch();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {name: '', phone: '', relationship: ''},
  });

  function navigateToMain() {
    dispatch(updateUserState('ACTIVE'));
  }

  async function onSubmit(data: FormData) {
    setIsLoading(true);
    setError(null);
    try {
      await escalationsApi.createEscalationContact({
        name: data.name,
        phone: data.phone,
        relationship: data.relationship,
      });
      navigateToMain();
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 422) {
        setError('Please check your contact information and try again.');
      } else {
        setError('Failed to add contact. You can add one later in Settings.');
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
        <Text style={styles.icon}>🤝</Text>
        <Text style={[styles.title, {color: colors.textPrimary}]}>
          Trusted Contact
        </Text>
        <Text style={[styles.description, {color: colors.textSecondary}]}>
          Add someone you trust who can be contacted in an emergency. This is
          optional — you can add or change this later in Settings.
        </Text>

        <View
          style={[
            styles.explainBox,
            {
              backgroundColor: colors.surfaceSecondary,
              borderLeftColor: colors.primary,
            },
          ]}>
          <Text style={[styles.explainText, {color: colors.textSecondary}]}>
            Your trusted contact will only be reached if you are in crisis and
            choose to contact them. They will not receive your personal data.
          </Text>
        </View>

        {error ? (
          <Text style={[styles.errorText, {color: colors.danger}]}>{error}</Text>
        ) : null}

        <Controller
          control={control}
          name="name"
          render={({field: {onChange, onBlur, value}}) => (
            <TextInput
              label="Full name"
              placeholder="Jane Smith"
              autoCapitalize="words"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.name?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="phone"
          render={({field: {onChange, onBlur, value}}) => (
            <TextInput
              label="Phone number"
              placeholder="+1 555 000 1234"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.phone?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="relationship"
          render={({field: {onChange, onBlur, value}}) => (
            <TextInput
              label="Relationship"
              placeholder="e.g. Parent, Partner, Friend"
              autoCapitalize="words"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.relationship?.message}
            />
          )}
        />

        <View style={styles.buttons}>
          <Button
            label="Add contact"
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
          />
          <Button
            label="Skip for now"
            onPress={navigateToMain}
            variant="ghost"
            disabled={isLoading}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {
    padding: PAGE_HORIZONTAL_PADDING,
    paddingTop: 56,
    paddingBottom: 40,
  },
  icon: {
    fontSize: 48,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  description: {
    fontSize: FONT_SIZE.md,
    lineHeight: FONT_SIZE.md * 1.4,
    marginBottom: SPACING.xl,
  },
  explainBox: {
    borderLeftWidth: 3,
    paddingLeft: SPACING.md,
    paddingVertical: SPACING.md,
    paddingRight: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.xl,
  },
  explainText: {
    fontSize: FONT_SIZE.sm,
    lineHeight: FONT_SIZE.sm * 1.4,
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    marginBottom: SPACING.md,
  },
  buttons: {
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
});
