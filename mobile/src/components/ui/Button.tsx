import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  useColorScheme,
} from 'react-native';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  BORDER_RADIUS,
  CTA_HEIGHT,
  FONT_SIZE,
  MIN_TAPPABLE,
} from '@/utils/constants';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  fullWidth = true,
}: ButtonProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const containerStyle: ViewStyle = {
    height: CTA_HEIGHT,
    minHeight: MIN_TAPPABLE,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    opacity: disabled || loading ? 0.5 : 1,
    ...(fullWidth ? {alignSelf: 'stretch'} : {}),
    ...(variant === 'primary' && {backgroundColor: colors.primary}),
    ...(variant === 'secondary' && {backgroundColor: colors.surfaceSecondary}),
    ...(variant === 'outline' && {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.primary,
    }),
    ...(variant === 'danger' && {backgroundColor: colors.danger}),
    ...(variant === 'ghost' && {backgroundColor: 'transparent'}),
  };

  const labelColor: string = (() => {
    switch (variant) {
      case 'primary':
        return '#ffffff';
      case 'secondary':
        return colors.textPrimary;
      case 'outline':
        return colors.primary;
      case 'danger':
        return '#ffffff';
      case 'ghost':
        return colors.primary;
    }
  })();

  return (
    <TouchableOpacity
      style={[containerStyle, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled: disabled || loading}}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? '#fff' : colors.primary}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.label,
            {color: labelColor},
            textStyle,
          ]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
