import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {AxiosError} from 'axios';

import {ConsentPayload, OnboardingStackParamList} from '@/types';
import {consentsApi} from '@/api/escalations';
import {Button} from '@/components/ui/Button';
import {ConsentToggle} from '@/components/ConsentToggle';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  PAGE_HORIZONTAL_PADDING,
  SPACING,
} from '@/utils/constants';

type NavProp = NativeStackNavigationProp<OnboardingStackParamList>;

export function ConsentScreen() {
  const navigation = useNavigation<NavProp>();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  // Required (must all be true to proceed)
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [dataCollectionAccepted, setDataCollectionAccepted] = useState(false);
  const [chatLoggingAccepted, setChatLoggingAccepted] = useState(false);

  // Optional
  const [healthDataAccepted, setHealthDataAccepted] = useState(false);
  const [locationAccepted, setLocationAccepted] = useState(false);
  const [noiseLevelAccepted, setNoiseLevelAccepted] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allRequiredAccepted =
    termsAccepted &&
    privacyAccepted &&
    dataCollectionAccepted &&
    chatLoggingAccepted;

  const consentPayload: ConsentPayload = {
    terms_of_service: termsAccepted,
    privacy_policy: privacyAccepted,
    data_collection: dataCollectionAccepted,
    chat_logging: chatLoggingAccepted,
    health_data_accepted: healthDataAccepted,
    location_category_accepted: locationAccepted,
    noise_level_accepted: noiseLevelAccepted,
  };

  async function handleSubmit() {
    if (!allRequiredAccepted) return;
    setIsLoading(true);
    setError(null);
    try {
      await consentsApi.submitConsents(consentPayload);
      navigation.navigate('PermissionSetup', {consentPayload});
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status && axiosErr.response.status >= 500) {
        setError('Server error. Please try again.');
      } else {
        setError('Failed to save consents. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ScrollView
      style={[styles.screen, {backgroundColor: colors.background}]}
      contentContainerStyle={styles.content}>
      <Text style={[styles.title, {color: colors.textPrimary}]}>
        Privacy & Permissions
      </Text>
      <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
        MindLift requires your consent for certain features. Required items are
        needed to use the app. Optional items can be toggled at any time.
      </Text>

      {/* Required */}
      <Text style={[styles.sectionHeader, {color: colors.textSecondary}]}>
        REQUIRED
      </Text>
      <View
        style={[
          styles.section,
          {backgroundColor: colors.surface, borderColor: colors.border},
        ]}>
        <ConsentToggle
          label="Terms of Service"
          description="You agree to our terms of service governing your use of MindLift."
          value={termsAccepted}
          onChange={setTermsAccepted}
          required
        />
        <ConsentToggle
          label="Privacy Policy"
          description="You have read and agree to our privacy policy."
          value={privacyAccepted}
          onChange={setPrivacyAccepted}
          required
        />
        <ConsentToggle
          label="Data Collection"
          description="We collect daily metrics (sleep, activity, mood) to monitor your wellness patterns."
          value={dataCollectionAccepted}
          onChange={setDataCollectionAccepted}
          required
        />
        <ConsentToggle
          label="Chat Logging"
          description="Support conversations are logged to improve the service and ensure safety. Logs are encrypted and not shared with third parties."
          value={chatLoggingAccepted}
          onChange={setChatLoggingAccepted}
          required
        />
      </View>

      {/* Optional */}
      <Text style={[styles.sectionHeader, {color: colors.textSecondary}]}>
        OPTIONAL
      </Text>
      <View
        style={[
          styles.section,
          {backgroundColor: colors.surface, borderColor: colors.border},
        ]}>
        <ConsentToggle
          label="Health Data"
          description="Access heart rate, HRV, and other health metrics from your device or wearable."
          value={healthDataAccepted}
          onChange={setHealthDataAccepted}
        />
        <ConsentToggle
          label="Location Category"
          description="Detect general location patterns (home, work, transit) — not precise GPS."
          value={locationAccepted}
          onChange={setLocationAccepted}
        />
        <ConsentToggle
          label="Ambient Noise Level"
          description="Monitor background noise level to infer social and environmental context."
          value={noiseLevelAccepted}
          onChange={setNoiseLevelAccepted}
        />
      </View>

      {error ? (
        <Text style={[styles.errorText, {color: colors.danger}]}>{error}</Text>
      ) : null}

      {!allRequiredAccepted && (
        <Text style={[styles.hintText, {color: colors.textTertiary}]}>
          Please accept all required items to continue.
        </Text>
      )}

      <Button
        label="Continue"
        onPress={handleSubmit}
        loading={isLoading}
        disabled={!allRequiredAccepted}
        style={styles.ctaBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {
    padding: PAGE_HORIZONTAL_PADDING,
    paddingTop: 56,
    paddingBottom: 40,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    lineHeight: FONT_SIZE.sm * 1.4,
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  section: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xl,
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  hintText: {
    fontSize: FONT_SIZE.sm,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  ctaBtn: {},
});
