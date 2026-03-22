/**
 * Offline metric queue backed by MMKV.
 * Stores queued metric uploads and retries them when online.
 */
import {storage} from '@/store/storage';
import {DailyMetrics, QueuedMetric} from '@/types';
import {STORAGE_KEYS} from '@/utils/constants';
import {isoNow, isOlderThanDays} from '@/utils/formatters';

const QUEUE_KEY = STORAGE_KEYS.METRIC_QUEUE;
const MAX_AGE_DAYS = 7;
const MAX_ATTEMPTS = 5;

function readQueue(): QueuedMetric[] {
  try {
    const raw = storage.getString(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedMetric[];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedMetric[]): void {
  storage.set(QUEUE_KEY, JSON.stringify(queue));
}

export const localQueue = {
  /**
   * Add or update a metric entry in the queue.
   */
  enqueue(date: string, metrics: DailyMetrics): void {
    const queue = readQueue();
    const existing = queue.findIndex(q => q.date === date);
    if (existing >= 0) {
      queue[existing] = {...queue[existing], metrics, attempts: 0};
    } else {
      queue.push({date, metrics, attempts: 0, queued_at: isoNow()});
    }
    writeQueue(queue);
  },

  /**
   * Get all items that are ready to be uploaded (not expired, under max attempts).
   */
  getPending(): QueuedMetric[] {
    const queue = readQueue();
    return queue.filter(
      item =>
        item.attempts < MAX_ATTEMPTS && !isOlderThanDays(item.date, MAX_AGE_DAYS),
    );
  },

  /**
   * Mark an entry as successfully uploaded (removes it).
   */
  markUploaded(date: string): void {
    const queue = readQueue().filter(q => q.date !== date);
    writeQueue(queue);
  },

  /**
   * Increment attempt count for an entry.
   */
  incrementAttempts(date: string): void {
    const queue = readQueue();
    const idx = queue.findIndex(q => q.date === date);
    if (idx >= 0) {
      queue[idx].attempts = (queue[idx].attempts ?? 0) + 1;
      writeQueue(queue);
    }
  },

  /**
   * Remove entries older than MAX_AGE_DAYS and return the dates dropped.
   */
  pruneStale(): string[] {
    const queue = readQueue();
    const stale = queue.filter(q => isOlderThanDays(q.date, MAX_AGE_DAYS));
    const fresh = queue.filter(q => !isOlderThanDays(q.date, MAX_AGE_DAYS));
    if (stale.length > 0) {
      writeQueue(fresh);
      stale.forEach(s =>
        console.warn(`[localQueue] Dropped stale metric entry for date ${s.date}`),
      );
    }
    return stale.map(s => s.date);
  },

  /**
   * Get total queued count.
   */
  count(): number {
    return readQueue().length;
  },

  /**
   * Check if there are any stale entries (older than MAX_AGE_DAYS).
   */
  hasStaleEntries(): boolean {
    return readQueue().some(q => isOlderThanDays(q.date, MAX_AGE_DAYS));
  },

  clearAll(): void {
    writeQueue([]);
  },
};
