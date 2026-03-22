import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  BackHandler,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {RootStackParamList} from '@/types';
import {useAppDispatch} from '@/store';
import {logout} from '@/store/authSlice';
import {Button} from '@/components/ui/Button';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  PAGE_HORIZONTAL_PADDING,
  SPACING,
} from '@/utils/constants';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export function DeletionRequestedScreen() {
  const navigation = useNavigation<NavProp>();
  const dispatch = useAppDispatch();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  // Block back navigation
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  function handleGoToLogin() {
    dispatch(logout());
    // RootNavigator will switch to Auth stack automatically
  }

  return (
    <View style={[styles.screen, {backgroundColor: colors.background}]}>
      <View style={styles.content}>
        <Text style={styles.icon}>🗑️</Text>
        <Text style={[styles.title, {color: colors.textPrimary}]}>
          Account deletion requested
        </Text>
        <Text style={[styles.body, {color: colors.textSecondary}]}>
          Your account deletion has been requested. Your data will be
          permanently deleted within 24 hours.
        </Text>
        <Button
          label="Back to Login"
          onPress={handleGoToLogin}
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
