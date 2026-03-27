import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  Modal,
  Switch,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {MainStackParamList} from '@/types';
import {accountApi} from '@/api/escalations';
import {useAppDispatch, useAppSelector} from '@/store';
import {logout} from '@/store/authSlice';
import {notificationService} from '@/services/notificationService';
import {Button} from '@/components/ui/Button';
import {
  APP_VERSION,
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  MIN_TAPPABLE,
  PAGE_HORIZONTAL_PADDING,
  SPACING,
} from '@/utils/constants';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

export function SettingsScreen() {
  const navigation = useNavigation<NavProp>();
  const dispatch = useAppDispatch();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const {email, firstName} = useAppSelector(state => state.auth);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const quietHours = notificationService.getQuietHours();
  const [quietStart, setQuietStart] = useState(quietHours.start);
  const [quietEnd, setQuietEnd] = useState(quietHours.end);

  function handleQuietToggle(enabled: boolean) {
    const newStart = enabled ? 22 : 0;
    const newEnd = enabled ? 7 : 0;
    setQuietStart(newStart);
    setQuietEnd(newEnd);
    notificationService.setQuietHours(newStart, newEnd);
  }

  const quietEnabled = quietStart === 22 && quietEnd === 7;

  async function handleExport() {
    setIsExporting(true);
    try {
      const res = await accountApi.requestExport();
      navigation.navigate('ExportRequested', {taskId: res.data.task_id});
    } catch {
      Alert.alert('Error', 'Failed to request data export. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDeleteAccount() {
    setIsDeleting(true);
    try {
      await accountApi.deleteAccount();
      setDeleteModalVisible(false);
      dispatch(logout());
      navigation.navigate('DeletionRequested');
    } catch {
      Alert.alert(
        'Error',
        'Failed to delete account. Please try again or contact support.',
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function signOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => dispatch(logout()),
      },
    ]);
  }

  return (
    <ScrollView
      style={[styles.screen, {backgroundColor: colors.background}]}
      contentContainerStyle={styles.content}>
      <Text style={[styles.pageTitle, {color: colors.textPrimary}]}>
        Settings
      </Text>

      {/* Account section */}
      <Text style={[styles.sectionHeader, {color: colors.textSecondary}]}>
        ACCOUNT
      </Text>
      <View style={[styles.section, {backgroundColor: colors.surface, borderColor: colors.border}]}>
        <SettingsRow
          label="Name"
          value={firstName ?? '—'}
          colors={colors}
        />
        <SettingsRow
          label="Email"
          value={email ?? '—'}
          colors={colors}
          divider
        />
        <SettingsActionRow
          label="Change password"
          colors={colors}
          onPress={() => {
            // Would navigate to change password screen
          }}
        />
      </View>

      {/* Notifications section */}
      <Text style={[styles.sectionHeader, {color: colors.textSecondary}]}>
        NOTIFICATIONS
      </Text>
      <View style={[styles.section, {backgroundColor: colors.surface, borderColor: colors.border}]}>
        <View style={styles.settingsRow}>
          <View style={styles.rowLeft}>
            <Text style={[styles.rowLabel, {color: colors.textPrimary}]}>
              Quiet hours (22:00–07:00)
            </Text>
            <Text style={[styles.rowValue, {color: colors.textSecondary}]}>
              No notifications between 10 PM and 7 AM
            </Text>
          </View>
          <Switch
            value={quietEnabled}
            onValueChange={handleQuietToggle}
            trackColor={{false: colors.border, true: colors.primary}}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      {/* Privacy section */}
      <Text style={[styles.sectionHeader, {color: colors.textSecondary}]}>
        PRIVACY
      </Text>
      <View style={[styles.section, {backgroundColor: colors.surface, borderColor: colors.border}]}>
        <SettingsActionRow
          label="View & update consents"
          colors={colors}
          onPress={() => navigation.navigate('ConsentUpdate')}
        />
        <SettingsActionRow
          label="Manage permissions"
          colors={colors}
          onPress={() => {
            // Would navigate to permission settings
          }}
          divider
        />
      </View>

      {/* Data section */}
      <Text style={[styles.sectionHeader, {color: colors.textSecondary}]}>
        DATA
      </Text>
      <View style={[styles.section, {backgroundColor: colors.surface, borderColor: colors.border}]}>
        <TouchableOpacity
          style={styles.settingsRow}
          onPress={handleExport}
          disabled={isExporting}
          accessibilityRole="button"
          accessibilityLabel="Request data export">
          <Text style={[styles.rowLabel, {color: colors.primary}]}>
            {isExporting ? 'Requesting…' : 'Request data export'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* App info */}
      <Text style={[styles.sectionHeader, {color: colors.textSecondary}]}>
        APP
      </Text>
      <View style={[styles.section, {backgroundColor: colors.surface, borderColor: colors.border}]}>
        <SettingsRow label="Version" value={APP_VERSION} colors={colors} />
      </View>

      {/* Sign out */}
      <Button
        label="Sign out"
        onPress={signOut}
        variant="outline"
        style={styles.signOutBtn}
      />

      {/* Delete account */}
      <Button
        label="Delete account"
        onPress={() => setDeleteModalVisible(true)}
        variant="danger"
        style={styles.deleteBtn}
      />

      {/* Delete confirmation modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalBox, {backgroundColor: colors.surface}]}>
            <Text style={[styles.modalTitle, {color: colors.textPrimary}]}>
              Delete account
            </Text>
            <Text style={[styles.modalBody, {color: colors.textSecondary}]}>
              This will permanently delete your account and all associated data
              within 24 hours. This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <Button
                label="Cancel"
                onPress={() => setDeleteModalVisible(false)}
                variant="secondary"
                disabled={isDeleting}
              />
              <Button
                label={isDeleting ? 'Deleting…' : 'Delete permanently'}
                onPress={handleDeleteAccount}
                variant="danger"
                loading={isDeleting}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function SettingsRow({
  label,
  value,
  colors,
  divider = false,
}: {
  label: string;
  value: string;
  colors: typeof COLORS_LIGHT;
  divider?: boolean;
}) {
  return (
    <View
      style={[
        styles.settingsRow,
        divider && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}>
      <Text style={[styles.rowLabel, {color: colors.textPrimary}]}>
        {label}
      </Text>
      <Text style={[styles.rowValue, {color: colors.textSecondary}]}>
        {value}
      </Text>
    </View>
  );
}

function SettingsActionRow({
  label,
  onPress,
  colors,
  divider = false,
}: {
  label: string;
  onPress: () => void;
  colors: typeof COLORS_LIGHT;
  divider?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.settingsRow,
        divider && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button">
      <Text style={[styles.rowLabel, {color: colors.primary}]}>{label}</Text>
      <Text style={[styles.rowChevron, {color: colors.textTertiary}]}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {
    padding: PAGE_HORIZONTAL_PADDING,
    paddingTop: 56,
    paddingBottom: 48,
  },
  pageTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  section: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: MIN_TAPPABLE,
    paddingVertical: SPACING.sm,
  },
  rowLeft: {
    flex: 1,
    marginRight: SPACING.md,
  },
  rowLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: FONT_SIZE.sm,
  },
  rowChevron: {
    fontSize: FONT_SIZE.xl,
  },
  signOutBtn: {
    marginTop: SPACING.xl,
  },
  deleteBtn: {
    marginTop: SPACING.sm,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: PAGE_HORIZONTAL_PADDING,
  },
  modalBox: {
    borderRadius: 20,
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
  },
  modalBody: {
    fontSize: FONT_SIZE.sm,
    lineHeight: FONT_SIZE.sm * 1.4,
  },
  modalButtons: {
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
});
