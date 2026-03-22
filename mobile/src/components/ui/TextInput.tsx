import React, {forwardRef} from 'react';
import {
  View,
  TextInput as RNTextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  useColorScheme,
} from 'react-native';
import {
  BORDER_RADIUS,
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  MIN_TAPPABLE,
  SPACING,
} from '@/utils/constants';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  hint?: string;
}

export const TextInput = forwardRef<RNTextInput, Props>(
  ({label, error, containerStyle, hint, style, ...rest}, ref) => {
    const isDark = useColorScheme() === 'dark';
    const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

    return (
      <View style={[styles.wrapper, containerStyle]}>
        {label ? (
          <Text style={[styles.label, {color: colors.textSecondary}]}>
            {label}
          </Text>
        ) : null}
        <RNTextInput
          ref={ref}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: error ? colors.danger : colors.border,
              color: colors.textPrimary,
            },
            style,
          ]}
          placeholderTextColor={colors.textTertiary}
          {...rest}
        />
        {hint && !error ? (
          <Text style={[styles.hint, {color: colors.textTertiary}]}>{hint}</Text>
        ) : null}
        {error ? (
          <Text style={[styles.error, {color: colors.danger}]}>{error}</Text>
        ) : null}
      </View>
    );
  },
);

TextInput.displayName = 'TextInput';

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    marginBottom: SPACING.xs,
  },
  input: {
    minHeight: MIN_TAPPABLE,
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: FONT_SIZE.md,
    lineHeight: FONT_SIZE.md * 1.4,
  },
  hint: {
    fontSize: FONT_SIZE.xs,
    marginTop: 4,
  },
  error: {
    fontSize: FONT_SIZE.xs,
    marginTop: 4,
    fontWeight: '500',
  },
});
