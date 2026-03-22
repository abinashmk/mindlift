/**
 * Notification service — manages push notification scheduling
 * while enforcing quiet hours and content safety rules.
 */
import {Platform} from 'react-native';
import {storage} from '@/store/storage';
import {STORAGE_KEYS} from '@/utils/constants';

const QUIET_HOURS_START_DEFAULT = 22;
const QUIET_HOURS_END_DEFAULT = 7;
const MAX_INTERVENTION_PER_DAY = 3;
const MAX_MOOD_REMINDER_PER_DAY = 1;

// Forbidden words in notification content (safety rule)
const FORBIDDEN_WORDS = [
  'crisis',
  'depression',
  'anxiety',
  'self-harm',
  'self harm',
  'suicide',
  'risk level',
  'high risk',
  'low risk',
] as const;

function isInQuietHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const startHour =
    storage.getNumber(STORAGE_KEYS.QUIET_HOURS_START) ??
    QUIET_HOURS_START_DEFAULT;
  const endHour =
    storage.getNumber(STORAGE_KEYS.QUIET_HOURS_END) ?? QUIET_HOURS_END_DEFAULT;

  if (startHour > endHour) {
    // Spans midnight: quiet if hour >= start OR hour < end
    return hour >= startHour || hour < endHour;
  }
  return hour >= startHour && hour < endHour;
}

function todayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function contentSafe(text: string): boolean {
  const lower = text.toLowerCase();
  return !FORBIDDEN_WORDS.some(word => lower.includes(word));
}

function validateContent(title: string, body: string): void {
  if (!contentSafe(title)) {
    throw new Error(
      `[notificationService] Notification title contains forbidden content: "${title}"`,
    );
  }
  if (!contentSafe(body)) {
    throw new Error(
      `[notificationService] Notification body contains forbidden content: "${body}"`,
    );
  }
}

export const notificationService = {
  /**
   * Request notification permission (iOS).
   * Android 13+ handled by permissionService.
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      // Would use @notifee/react-native or similar in production
      // Placeholder — returns true to allow testing
      return true;
    }
    return true;
  },

  /**
   * Show an intervention notification, enforcing:
   * - Quiet hours
   * - Max 3 per day
   * - Forbidden content check
   */
  async showInterventionNotification(title: string, body: string): Promise<boolean> {
    validateContent(title, body);

    if (isInQuietHours()) {
      return false;
    }

    const today = todayDateString();
    const lastDate = storage.getString(STORAGE_KEYS.INTERVENTION_NOTIF_DATE);
    const count = storage.getNumber(STORAGE_KEYS.INTERVENTION_NOTIF_COUNT) ?? 0;

    const todayCount = lastDate === today ? count : 0;

    if (todayCount >= MAX_INTERVENTION_PER_DAY) {
      return false;
    }

    // In a real app, call a notification library (notifee, react-native-push-notification, etc.)
    console.log(`[notification] INTERVENTION: ${title} — ${body}`);

    storage.set(STORAGE_KEYS.INTERVENTION_NOTIF_DATE, today);
    storage.set(STORAGE_KEYS.INTERVENTION_NOTIF_COUNT, todayCount + 1);
    return true;
  },

  /**
   * Show a mood reminder notification, enforcing:
   * - Quiet hours
   * - Max 1 per day
   * - Forbidden content check
   */
  async showMoodReminderNotification(): Promise<boolean> {
    const title = 'MindLift reminder';
    const body = 'How are you feeling today? Take a moment to log your mood.';

    validateContent(title, body);

    if (isInQuietHours()) {
      return false;
    }

    const today = todayDateString();
    const lastDate = storage.getString(STORAGE_KEYS.MOOD_REMINDER_DATE);

    if (lastDate === today) {
      return false;
    }

    console.log(`[notification] MOOD: ${title} — ${body}`);
    storage.set(STORAGE_KEYS.MOOD_REMINDER_DATE, today);
    return true;
  },

  /**
   * Show a check-in notification.
   */
  async showCheckInNotification(): Promise<boolean> {
    const title = 'You have a new check-in';
    const body = 'Your daily check-in is ready.';

    validateContent(title, body);

    if (isInQuietHours()) {
      return false;
    }

    console.log(`[notification] CHECK-IN: ${title} — ${body}`);
    return true;
  },

  getQuietHours(): {start: number; end: number} {
    return {
      start:
        storage.getNumber(STORAGE_KEYS.QUIET_HOURS_START) ??
        QUIET_HOURS_START_DEFAULT,
      end:
        storage.getNumber(STORAGE_KEYS.QUIET_HOURS_END) ??
        QUIET_HOURS_END_DEFAULT,
    };
  },

  setQuietHours(start: number, end: number): void {
    storage.set(STORAGE_KEYS.QUIET_HOURS_START, start);
    storage.set(STORAGE_KEYS.QUIET_HOURS_END, end);
  },
};
