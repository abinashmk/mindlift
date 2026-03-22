import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  useColorScheme,
} from 'react-native';
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
          shadowColor: isDark ? '#000' : '#000',
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
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
});
