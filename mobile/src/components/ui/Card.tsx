import React from 'react';
import {View, StyleSheet, ViewStyle, useColorScheme} from 'react-native';
import {
  CARD_PADDING,
  CARD_RADIUS,
  COLORS_DARK,
  COLORS_LIGHT,
} from '@/utils/constants';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
}

export function Card({children, style, padding = CARD_PADDING}: CardProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: isDark ? '#000' : '#3d2d6e',
          padding,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
});
