import React from 'react';
import {View, Text, StyleSheet, useColorScheme} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {MainStackParamList} from '@/types';
import {Button} from '@/components/ui/Button';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  PAGE_HORIZONTAL_PADDING,
  SPACING,
} from '@/utils/constants';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

export function ExportRequestedScreen() {
  const navigation = useNavigation<NavProp>();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  return (
    <View style={[styles.screen, {backgroundColor: colors.background}]}>
      <View style={styles.content}>
        <Text style={styles.icon}>📬</Text>
        <Text style={[styles.title, {color: colors.textPrimary}]}>
          Export requested
        </Text>
        <Text style={[styles.body, {color: colors.textSecondary}]}>
          Your data export has been requested. You will receive a download link
          by email within a few minutes.
        </Text>
        <Button
          label="Back to Settings"
          onPress={() => navigation.goBack()}
          style={styles.btn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {
    flex: 1,
    padding: PAGE_HORIZONTAL_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
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
  body: {
    fontSize: FONT_SIZE.md,
    lineHeight: FONT_SIZE.md * 1.4,
    textAlign: 'center',
    marginBottom: SPACING.xxxl,
  },
  btn: {
    width: '100%',
  },
});
