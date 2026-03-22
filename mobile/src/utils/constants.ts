import {RiskLevel} from '@/types';

// ─── Risk Colors ──────────────────────────────────────────────────────────────

export const RISK_COLORS: Record<RiskLevel, string> = {
  GREEN: '#22c55e',
  YELLOW: '#facc15',
  ORANGE: '#f97316',
  RED: '#dc2626',
  UNDEFINED: '#9ca3af',
};

// ─── Risk Explanations ────────────────────────────────────────────────────────

export const RISK_EXPLANATIONS: Record<RiskLevel, string> = {
  GREEN: "You're doing well. Keep up your routines.",
  YELLOW: 'Some patterns are slightly off. A small action may help.',
  ORANGE: 'Several patterns need attention. Consider the suggested actions.',
  RED: 'Significant changes detected. Support has been notified.',
  UNDEFINED:
    'We are still learning your normal patterns. Risk insights will appear after enough data is collected.',
};

// ─── Design Tokens ────────────────────────────────────────────────────────────

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const FONT_SIZE = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 28,
} as const;

export const LINE_HEIGHT_MULTIPLIER = 1.4;

export const MIN_TAPPABLE = 44;
export const CTA_HEIGHT = 48;
export const PAGE_HORIZONTAL_PADDING = 16;
export const CARD_PADDING = 16;
export const CARD_VERTICAL_GAP = 12;
export const SECTION_GAP = 20;
export const CARD_RADIUS = 16;

// ─── Colors (light) ───────────────────────────────────────────────────────────

export const COLORS_LIGHT = {
  background: '#f9fafb',
  surface: '#ffffff',
  surfaceSecondary: '#f3f4f6',
  border: '#e5e7eb',
  divider: '#f0f0f0',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',
  primary: '#3b82f6',
  primaryDark: '#1d4ed8',
  primaryLight: '#eff6ff',
  danger: '#dc2626',
  dangerLight: '#fef2f2',
  warning: '#f97316',
  success: '#22c55e',
  successLight: '#f0fdf4',
  overlay: 'rgba(0,0,0,0.5)',
} as const;

export const COLORS_DARK = {
  background: '#0f172a',
  surface: '#1e293b',
  surfaceSecondary: '#0f172a',
  border: '#334155',
  divider: '#1e293b',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textTertiary: '#64748b',
  primary: '#60a5fa',
  primaryDark: '#93c5fd',
  primaryLight: '#1e3a5f',
  danger: '#f87171',
  dangerLight: '#450a0a',
  warning: '#fb923c',
  success: '#4ade80',
  successLight: '#052e16',
  overlay: 'rgba(0,0,0,0.7)',
} as const;

// ─── Notification Constants ───────────────────────────────────────────────────

export const QUIET_HOURS_START = 22; // 22:00
export const QUIET_HOURS_END = 7; // 07:00
export const MAX_INTERVENTION_NOTIFICATIONS_PER_DAY = 3;
export const MAX_MOOD_REMINDERS_PER_DAY = 1;

export const ALLOWED_NOTIFICATION_TITLES = [
  'You have a new check-in',
  'A short action is ready',
  'MindLift reminder',
] as const;

// ─── Mood Emojis ─────────────────────────────────────────────────────────────

export const MOOD_EMOJIS: Record<number, string> = {
  1: '😞',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😊',
};

// ─── Storage Keys ─────────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_ID: 'user_id',
  USER_STATE: 'user_state',
  FIRST_NAME: 'first_name',
  METRIC_QUEUE: 'metric_queue',
  QUIET_HOURS_START: 'quiet_hours_start',
  QUIET_HOURS_END: 'quiet_hours_end',
  DISCLOSURE_SHOWN: 'disclosure_shown',
  INTERVENTION_NOTIF_COUNT: 'intervention_notif_count',
  INTERVENTION_NOTIF_DATE: 'intervention_notif_date',
  MOOD_REMINDER_DATE: 'mood_reminder_date',
} as const;

// ─── App Version ─────────────────────────────────────────────────────────────

export const APP_VERSION = '1.0.0';

// ─── Disclosure Text ─────────────────────────────────────────────────────────

export const CLINICAL_DISCLOSURE =
  'MindLift is a self-management and support tool. It does not diagnose medical or mental-health conditions and does not replace a licensed clinician or emergency services.';

export const CHAT_AI_DISCLOSURE =
  'You are chatting with an AI assistant. It can offer general support and coping suggestions, but it cannot provide therapy, diagnosis, or emergency help.';

export const CRISIS_MESSAGE =
  "I'm concerned you may be in immediate distress. I cannot provide crisis support here. Please contact emergency services or a crisis hotline.";
