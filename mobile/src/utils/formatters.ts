import {MOOD_EMOJIS} from './constants';

// ─── Date / Time ─────────────────────────────────────────────────────────────

export function getGreeting(firstName: string): string {
  const hour = new Date().getHours();
  let timeOfDay: string;
  if (hour < 12) {
    timeOfDay = 'morning';
  } else if (hour < 17) {
    timeOfDay = 'afternoon';
  } else {
    timeOfDay = 'evening';
  }
  return `Good ${timeOfDay}, ${firstName}`;
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateShort(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function todayISODate(): string {
  return new Date().toISOString().split('T')[0];
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

export function isOlderThanDays(isoDate: string, days: number): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return new Date(isoDate) < cutoff;
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export function formatSleepHours(hours: number | null | undefined): string {
  if (hours == null) return '--';
  return `${hours.toFixed(1)} hrs`;
}

export function formatSteps(steps: number | null | undefined): string {
  if (steps == null) return '--';
  return steps.toLocaleString();
}

export function formatMood(score: number | null | undefined): string {
  if (score == null) return '--';
  const rounded = Math.round(score) as 1 | 2 | 3 | 4 | 5;
  return MOOD_EMOJIS[rounded] ?? '--';
}

export function formatBaselineComparison(
  current: number | null,
  baseline: number | null,
): string {
  if (current == null || baseline == null) return '';
  const diff = current - baseline;
  const pct = Math.abs(Math.round((diff / baseline) * 100));
  if (pct < 5) return 'About the same as usual';
  const direction = diff > 0 ? 'above' : 'below';
  return `${pct}% ${direction} your usual`;
}

// ─── Risk ─────────────────────────────────────────────────────────────────────

export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ─── Duration ─────────────────────────────────────────────────────────────────

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ─── Phone ────────────────────────────────────────────────────────────────────

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

// ─── Timezone ─────────────────────────────────────────────────────────────────

export function detectTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
