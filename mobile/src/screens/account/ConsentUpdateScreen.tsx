import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import {consentsApi} from '@/api/escalations';
import {useAppDispatch, useAppSelector} from '@/store';
import {setConsents} from '@/store/consentsSlice';
import {ConsentToggle} from '@/components/ConsentToggle';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  PAGE_HORIZONTAL_PADDING,
  SPACING,
} from '@/utils/constants';

export function ConsentUpdateScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const stored = useAppSelector(state => state.consents);

  const [health, setHealth] = useState(stored.health_data_accepted);
  const [location, setLocation] = useState(stored.location_category_accepted);
  const [noise, setNoise] = useState(stored.noise_level_accepted);
  const [saving, setSaving] = useState<string | null>(null);

  async function handleToggle(
    key: 'health_data_accepted' | 'location_category_accepted' | 'noise_level_accepted',
    value: boolean,
    setter: (v: boolean) => void,
  ) {
    setter(value);
    setSaving(key);
    try {
      await consentsApi.submitConsents({
        consent_key: key,
        consent_value: value,
        policy_version: '1.0',
      });
      dispatch(setConsents({[key]: value}));
    } catch {
      // Revert on failure
      setter(!value);
    } finally {
      setSaving(null);
    }
  }

  return (
    <ScrollView
      style={[styles.screen, {backgroundColor: colors.background}]}
      contentContainerStyle={styles.content}>
      {/* Back button */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Go back">
        <Text style={[styles.backText, {color: colors.primary}]}>‹ Back</Text>
      </TouchableOpacity>

      <Text style={[styles.title, {color: colors.textPrimary}]}>
        Manage Consents
      </Text>
      <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
        Optional data collection can be turned on or off at any time. Changes
        take effect immediately.
      </Text>

      <View
        style={[
          styles.section,
          {backgroundColor: colors.surface, borderColor: colors.border},
        ]}>
        <ConsentToggle
          label="Health Data"
          description="Access heart rate, HRV, and sleep data from your device."
          value={health}
          onChange={v => handleToggle('health_data_accepted', v, setHealth)}
          disabled={saving === 'health_data_accepted'}
        />
        <ConsentToggle
          label="Location Category"
          description="Detect general location patterns (home, work, transit) — not precise GPS."
          value={location}
          onChange={v => handleToggle('location_category_accepted', v, setLocation)}
          disabled={saving === 'location_category_accepted'}
        />
        <ConsentToggle
          label="Ambient Noise Level"
          description="Monitor background noise level to infer social context."
          value={noise}
          onChange={v => handleToggle('noise_level_accepted', v, setNoise)}
          disabled={saving === 'noise_level_accepted'}
        />
      </View>

      <Text style={[styles.note, {color: colors.textTertiary}]}>
        Previously collected data is retained until you request export or
        deletion.
      </Text>
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
  backBtn: {
    marginBottom: SPACING.md,
  },
  backText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
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
  section: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xl,
  },
  note: {
    fontSize: FONT_SIZE.xs,
    lineHeight: FONT_SIZE.xs * 1.5,
    textAlign: 'center',
  },
});
