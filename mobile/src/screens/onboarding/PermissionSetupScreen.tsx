import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ScrollView,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {OnboardingStackParamList, PermissionResults} from '@/types';
import {permissionService} from '@/services/permissionService';
import {devicesApi} from '@/api/escalations';
import {Button} from '@/components/ui/Button';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  PAGE_HORIZONTAL_PADDING,
  SPACING,
} from '@/utils/constants';
import {Platform} from 'react-native';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'PermissionSetup'
>;

interface PermissionStep {
  id: keyof PermissionResults;
  title: string;
  description: string;
  required: boolean;
  dependsOnConsent: boolean;
}

export function PermissionSetupScreen({route, navigation}: Props) {
  const {consentPayload} = route.params;
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const steps: PermissionStep[] = [
    {
      id: 'motion',
      title: 'Motion & Activity',
      description:
        'We use motion to track your activity patterns and detect changes in your daily routine.',
      required: true,
      dependsOnConsent: false,
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description:
        'We use notifications for check-ins and reminders. You control quiet hours in Settings.',
      required: true,
      dependsOnConsent: false,
    },
    ...(consentPayload.health_data_accepted
      ? [
          {
            id: 'health' as keyof PermissionResults,
            title: 'Health Data',
            description:
              'Access heart rate and sleep data for richer wellness insights.',
            required: false,
            dependsOnConsent: true,
          },
        ]
      : []),
    ...(consentPayload.location_category_accepted
      ? [
          {
            id: 'location' as keyof PermissionResults,
            title: 'Location (Category)',
            description:
              'Detect general location patterns — home, work, transit — not precise GPS.',
            required: false,
            dependsOnConsent: true,
          },
        ]
      : []),
    ...(consentPayload.noise_level_accepted
      ? [
          {
            id: 'microphone' as keyof PermissionResults,
            title: 'Ambient Noise',
            description:
              'Measure background noise level to help understand your environment.',
            required: false,
            dependsOnConsent: true,
          },
        ]
      : []),
  ];

  const [currentStep, setCurrentStep] = useState(0);
  const [results, setResults] = useState<Partial<PermissionResults>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  async function requestCurrentPermission() {
    if (!step) return;
    setIsLoading(true);
    setError(null);
    let granted = false;

    try {
      switch (step.id) {
        case 'motion':
          granted = await permissionService.requestMotion();
          break;
        case 'notifications':
          granted = await permissionService.requestNotifications();
          break;
        case 'health':
          granted = await permissionService.requestHealth();
          break;
        case 'location':
          granted = await permissionService.requestLocation();
          break;
        case 'microphone':
          granted = await permissionService.requestMicrophone();
          break;
      }

      const updated = {...results, [step.id]: granted};
      setResults(updated);

      if (isLastStep) {
        await finishPermissions(updated as PermissionResults);
      } else {
        setCurrentStep(prev => prev + 1);
      }
    } catch {
      setError('Failed to request permission. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function skipCurrent() {
    const updated = {...results, [step.id]: false};
    setResults(updated);
    if (isLastStep) {
      await finishPermissions(updated as PermissionResults);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }

  async function finishPermissions(finalResults: PermissionResults) {
    setIsLoading(true);
    try {
      await devicesApi.registerDevice({
        platform: Platform.OS as 'ios' | 'android',
        push_token: null,
        permissions: finalResults,
      });
      navigation.navigate('TrustedContact');
    } catch {
      setError('Failed to register device. Continuing anyway.');
      navigation.navigate('TrustedContact');
    } finally {
      setIsLoading(false);
    }
  }

  if (!step) {
    return null;
  }

  const progress = (currentStep + 1) / steps.length;

  return (
    <ScrollView
      style={[styles.screen, {backgroundColor: colors.background}]}
      contentContainerStyle={styles.content}>
      {/* Progress */}
      <View
        style={[styles.progressTrack, {backgroundColor: colors.surfaceSecondary}]}>
        <View
          style={[
            styles.progressFill,
            {backgroundColor: colors.primary, width: `${progress * 100}%`},
          ]}
        />
      </View>
      <Text style={[styles.stepCount, {color: colors.textTertiary}]}>
        Step {currentStep + 1} of {steps.length}
      </Text>

      {/* Icon */}
      <Text style={styles.icon}>
        {step.id === 'motion'
          ? '🏃'
          : step.id === 'notifications'
          ? '🔔'
          : step.id === 'health'
          ? '❤️'
          : step.id === 'location'
          ? '📍'
          : '🎤'}
      </Text>

      <Text style={[styles.title, {color: colors.textPrimary}]}>
        {step.title}
      </Text>
      <Text style={[styles.description, {color: colors.textSecondary}]}>
        {step.description}
      </Text>

      {step.required && (
        <View
          style={[
            styles.requiredNote,
            {backgroundColor: colors.primaryLight},
          ]}>
          <Text style={[styles.requiredNoteText, {color: colors.primary}]}>
            This permission is required to use MindLift.
          </Text>
        </View>
      )}

      {error ? (
        <Text style={[styles.errorText, {color: colors.danger}]}>{error}</Text>
      ) : null}

      <View style={styles.buttons}>
        <Button
          label="Allow access"
          onPress={requestCurrentPermission}
          loading={isLoading}
        />
        {!step.required && (
          <Button
            label="Skip"
            onPress={skipCurrent}
            variant="ghost"
            disabled={isLoading}
            style={styles.skipBtn}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {
    padding: PAGE_HORIZONTAL_PADDING,
    paddingTop: 48,
    paddingBottom: 40,
    alignItems: 'center',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    width: '100%',
    marginBottom: SPACING.xs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  stepCount: {
    fontSize: FONT_SIZE.xs,
    alignSelf: 'flex-end',
    marginBottom: SPACING.xxxl,
  },
  icon: {
    fontSize: 56,
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  description: {
    fontSize: FONT_SIZE.md,
    lineHeight: FONT_SIZE.md * 1.4,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  requiredNote: {
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
    width: '100%',
  },
  requiredNoteText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  buttons: {
    width: '100%',
    gap: SPACING.sm,
  },
  skipBtn: {},
});
