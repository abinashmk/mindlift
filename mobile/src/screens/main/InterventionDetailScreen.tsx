import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  Modal,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {AxiosError} from 'axios';

import {InterventionEvent, MainStackParamList} from '@/types';
import {interventionsApi} from '@/api/interventions';
import {useAppDispatch} from '@/store';
import {updateIntervention} from '@/store/metricsSlice';
import {Button} from '@/components/ui/Button';
import {InterventionStatusBadge} from '@/components/ui/Badge';
import {MoodPicker} from '@/components/MoodPicker';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  PAGE_HORIZONTAL_PADDING,
  SPACING,
  BORDER_RADIUS,
} from '@/utils/constants';
import {formatDuration} from '@/utils/formatters';

type Props = NativeStackScreenProps<MainStackParamList, 'InterventionDetail'>;

function renderMarkdownAsPlainText(md: string): string {
  // Strip markdown markers and render as numbered plain text
  return md
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .trim();
}

export function InterventionDetailScreen({route, navigation}: Props) {
  const {eventId} = route.params;
  const dispatch = useAppDispatch();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const [intervention, setIntervention] = useState<InterventionEvent | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await interventionsApi.getIntervention(eventId);
        if (!cancelled) {
          setIntervention(res.data);
          // Mark as viewed if still TRIGGERED
          if (res.data.status === 'TRIGGERED') {
            try {
              const updated = await interventionsApi.updateIntervention(
                eventId,
                {status: 'VIEWED'},
              );
              if (!cancelled) setIntervention(updated.data);
              dispatch(updateIntervention(updated.data));
            } catch {
              // Non-critical
            }
          }
        }
      } catch {
        if (!cancelled) setError('Failed to load intervention details.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [eventId, dispatch]);

  async function handleComplete() {
    setShowRatingModal(true);
  }

  async function submitComplete(helpfulRating: number | null) {
    setShowRatingModal(false);
    setActionLoading(true);
    setError(null);
    try {
      const payload: Parameters<typeof interventionsApi.updateIntervention>[1] =
        {
          status: 'COMPLETED',
          ...(helpfulRating != null ? {helpful_rating: helpfulRating} : {}),
        };
      const res = await interventionsApi.updateIntervention(eventId, payload);
      setIntervention(res.data);
      dispatch(updateIntervention(res.data));
    } catch (err) {
      const axiosErr = err as AxiosError;
      setError(
        axiosErr.response?.status === 409
          ? 'This action has already been completed.'
          : 'Failed to update. Please try again.',
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDismiss() {
    setActionLoading(true);
    setError(null);
    try {
      const res = await interventionsApi.updateIntervention(eventId, {
        status: 'DISMISSED',
      });
      setIntervention(res.data);
      dispatch(updateIntervention(res.data));
      navigation.goBack();
    } catch {
      setError('Failed to dismiss. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  const isDone =
    intervention?.status === 'COMPLETED' ||
    intervention?.status === 'DISMISSED' ||
    intervention?.status === 'EXPIRED';

  return (
    <View style={[styles.screen, {backgroundColor: colors.background}]}>
      {/* Header */}
      <View style={[styles.header, {borderBottomColor: colors.border}]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <Text style={[styles.backIcon, {color: colors.primary}]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
          Action
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <Text style={[styles.loadingText, {color: colors.textSecondary}]}>
            Loading…
          </Text>
        ) : intervention ? (
          <>
            <Text style={[styles.name, {color: colors.textPrimary}]}>
              {intervention.name}
            </Text>
            <View style={styles.metaRow}>
              <Text style={[styles.duration, {color: colors.textSecondary}]}>
                ⏱ {formatDuration(intervention.duration_minutes)}
              </Text>
              <InterventionStatusBadge status={intervention.status} />
            </View>

            {error ? (
              <Text style={[styles.errorText, {color: colors.danger}]}>
                {error}
              </Text>
            ) : null}

            <View
              style={[
                styles.instructionsBox,
                {backgroundColor: colors.surfaceSecondary},
              ]}>
              <Text
                style={[styles.instructionsText, {color: colors.textPrimary}]}>
                {renderMarkdownAsPlainText(intervention.instructions_markdown)}
              </Text>
            </View>

            {!isDone && (
              <View style={styles.actions}>
                <Button
                  label="Mark Complete"
                  onPress={handleComplete}
                  loading={actionLoading}
                />
                <Button
                  label="Dismiss"
                  onPress={handleDismiss}
                  variant="outline"
                  loading={actionLoading}
                  style={styles.dismissBtn}
                />
              </View>
            )}

            {intervention.status === 'COMPLETED' && (
              <View
                style={[
                  styles.completedBanner,
                  {backgroundColor: colors.successLight},
                ]}>
                <Text style={[styles.completedText, {color: colors.success}]}>
                  ✓ Completed
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text style={[styles.errorText, {color: colors.danger}]}>
            {error ?? 'Intervention not found.'}
          </Text>
        )}
      </ScrollView>

      {/* Rating modal */}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRatingModal(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              {backgroundColor: colors.surface},
            ]}>
            <Text style={[styles.modalTitle, {color: colors.textPrimary}]}>
              Was this helpful?
            </Text>
            <Text style={[styles.modalSubtitle, {color: colors.textSecondary}]}>
              Rate this action (optional)
            </Text>
            <MoodPicker
              value={rating}
              onChange={v => setRating(v)}
            />
            <View style={styles.modalButtons}>
              <Button
                label="Submit rating"
                onPress={() => submitComplete(rating)}
              />
              <Button
                label="Skip rating"
                onPress={() => submitComplete(null)}
                variant="ghost"
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAGE_HORIZONTAL_PADDING,
    paddingTop: 56,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  content: {
    padding: PAGE_HORIZONTAL_PADDING,
    paddingTop: SPACING.xl,
    paddingBottom: 40,
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
    marginTop: 60,
  },
  name: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  duration: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    marginBottom: SPACING.md,
  },
  instructionsBox: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  instructionsText: {
    fontSize: FONT_SIZE.md,
    lineHeight: FONT_SIZE.md * 1.4,
  },
  actions: {
    gap: SPACING.sm,
  },
  dismissBtn: {},
  completedBanner: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  completedText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.xl,
    paddingBottom: 40,
    gap: SPACING.md,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  modalButtons: {
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
});
