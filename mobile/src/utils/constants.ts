import {RiskLevel} from '@/types';

// ─── Risk Colors ──────────────────────────────────────────────────────────────
// Muted, accessible palette — less clinical than pure red/green

export const RISK_COLORS: Record<RiskLevel, string> = {
  GREEN:     '#2daa78',
  YELLOW:    '#d4a53a',
  ORANGE:    '#d47040',
  RED:       '#c94545',
  UNDEFINED: '#a09ab8',
};

// ─── Risk Explanations ────────────────────────────────────────────────────────

export const RISK_EXPLANATIONS: Record<RiskLevel, string> = {
  GREEN:
    'Your sleep, activity, and mood are tracking well. Keep it up.',
  YELLOW:
    'Some patterns are shifting. A small recovery action may help.',
  ORANGE:
    'Your burnout indicators need attention. Check the suggested action below.',
  RED:
    'High burnout load detected. Support has been notified.',
  UNDEFINED:
    'Still building your baseline. Burnout load insights appear after a few days of tracking.',
};

// Human-readable labels for stress sources
export const STRESS_SOURCE_LABELS: Record<string, string> = {
  workload:      'Heavy workload',
  deadlines:     'Deadlines / exams',
  career:        'Career uncertainty',
  finances:      'Financial pressure',
  relationships: 'Relationships',
  other:         'Something else',
};

// ─── Design Tokens ────────────────────────────────────────────────────────────

export const SPACING = {
  xs:   4,
  sm:   8,
  md:   14,
  lg:   18,
  xl:   22,
  xxl:  28,
  xxxl: 36,
} as const;

export const BORDER_RADIUS = {
  sm:   8,
  md:   14,
  lg:   20,
  xl:   28,
  full: 9999,
} as const;

export const FONT_SIZE = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   21,
  xxl:  26,
  xxxl: 32,
} as const;

export const LINE_HEIGHT_MULTIPLIER = 1.5;

export const MIN_TAPPABLE          = 44;
export const CTA_HEIGHT            = 52;
export const PAGE_HORIZONTAL_PADDING = 20;
export const CARD_PADDING          = 20;
export const CARD_VERTICAL_GAP     = 16;
export const SECTION_GAP           = 28;
export const CARD_RADIUS           = 20;

// ─── Colors (light) ───────────────────────────────────────────────────────────
// Warm lavender-white background, muted violet primary

export const COLORS_LIGHT = {
  background:       '#f7f5fc',
  surface:          '#ffffff',
  surfaceSecondary: '#f0ecf8',
  border:           '#e6e1f0',
  divider:          '#ede9f5',
  textPrimary:      '#1a1535',
  textSecondary:    '#6b6188',
  textTertiary:     '#a29cbf',
  primary:          '#7b5ea7',
  primaryDark:      '#5a3d88',
  primaryLight:     '#f0ebff',
  danger:           '#c94545',
  dangerLight:      '#fdf0f0',
  warning:          '#c47830',
  success:          '#2daa78',
  successLight:     '#edf8f3',
  overlay:          'rgba(26,21,53,0.5)',
} as const;

// ─── Colors (dark) ────────────────────────────────────────────────────────────
// Deep indigo-black, soft violet accents

export const COLORS_DARK = {
  background:       '#100d1e',
  surface:          '#1c1830',
  surfaceSecondary: '#100d1e',
  border:           '#2e2850',
  divider:          '#1c1830',
  textPrimary:      '#ede8ff',
  textSecondary:    '#9e98bc',
  textTertiary:     '#635d85',
  primary:          '#a48cdd',
  primaryDark:      '#c4b0ff',
  primaryLight:     '#2a2050',
  danger:           '#e07070',
  dangerLight:      '#3a1515',
  warning:          '#e09850',
  success:          '#4dc898',
  successLight:     '#0d2e22',
  overlay:          'rgba(0,0,0,0.72)',
} as const;

// ─── Notification Constants ───────────────────────────────────────────────────

export const QUIET_HOURS_START = 22;
export const QUIET_HOURS_END   = 7;
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
  ACCESS_TOKEN:              'access_token',
  REFRESH_TOKEN:             'refresh_token',
  USER_ID:                   'user_id',
  USER_STATE:                'user_state',
  FIRST_NAME:                'first_name',
  METRIC_QUEUE:              'metric_queue',
  QUIET_HOURS_START:         'quiet_hours_start',
  QUIET_HOURS_END:           'quiet_hours_end',
  DISCLOSURE_SHOWN:          'disclosure_shown',
  INTERVENTION_NOTIF_COUNT:  'intervention_notif_count',
  INTERVENTION_NOTIF_DATE:   'intervention_notif_date',
  MOOD_REMINDER_DATE:        'mood_reminder_date',
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
