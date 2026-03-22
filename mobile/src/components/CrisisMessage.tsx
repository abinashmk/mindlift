import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  CRISIS_MESSAGE,
  FONT_SIZE,
  SPACING,
  CTA_HEIGHT,
  MIN_TAPPABLE,
  BORDER_RADIUS,
} from '@/utils/constants';

interface CrisisMessageProps {
  hasTrustedContact: boolean;
  onMessageSupport: () => void;
}

export function CrisisMessage({
  hasTrustedContact,
  onMessageSupport,
}: CrisisMessageProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  function call911() {
    Linking.openURL('tel:911');
  }

  function call988() {
    Linking.openURL('tel:988');
  }

  function contactTrustedPerson() {
    if (!hasTrustedContact) return;
    // In a real app, this would look up and call/text the trusted contact
    Linking.openURL('tel:');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.warningIcon}>⚠️</Text>
      <Text style={[styles.message, {color: colors.textPrimary}]}>
        {CRISIS_MESSAGE}
      </Text>

      <View style={styles.buttonStack}>
        <CrisisButton
          label="Call 911"
          onPress={call911}
          variant="danger"
          colors={colors}
        />
        <CrisisButton
          label="Call or text 988"
          onPress={call988}
          variant="danger"
          colors={colors}
        />
        <CrisisButton
          label="Contact trusted person"
          onPress={contactTrustedPerson}
          variant="secondary"
          disabled={!hasTrustedContact}
          colors={colors}
        />
        <CrisisButton
          label="Message support"
          onPress={onMessageSupport}
          variant="outline"
          colors={colors}
        />
      </View>
    </View>
  );
}

interface CrisisButtonProps {
  label: string;
  onPress: () => void;
  variant: 'danger' | 'secondary' | 'outline';
  disabled?: boolean;
  colors: typeof COLORS_LIGHT;
}

function CrisisButton({
  label,
  onPress,
  variant,
  disabled = false,
  colors,
}: CrisisButtonProps) {
  const bg =
    variant === 'danger'
      ? colors.danger
      : variant === 'secondary'
      ? colors.surfaceSecondary
      : 'transparent';

  const textColor =
    variant === 'danger'
      ? '#ffffff'
      : variant === 'outline'
      ? colors.primary
      : colors.textPrimary;

  const border =
    variant === 'outline'
      ? {borderWidth: 1.5, borderColor: colors.primary}
      : {};

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        {backgroundColor: bg, opacity: disabled ? 0.4 : 1},
        border,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled}}>
      <Text style={[styles.btnText, {color: textColor}]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  warningIcon: {
    fontSize: 56,
    marginBottom: SPACING.xl,
  },
  message: {
    fontSize: FONT_SIZE.md,
    lineHeight: FONT_SIZE.md * 1.4,
    textAlign: 'center',
    marginBottom: SPACING.xxxl,
    fontWeight: '500',
  },
  buttonStack: {
    width: '100%',
    gap: SPACING.md,
  },
  btn: {
    height: CTA_HEIGHT,
    minHeight: MIN_TAPPABLE,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
});
