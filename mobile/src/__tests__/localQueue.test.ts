/**
 * Offline queue retry logic — spec §37.3
 *
 * Tests that pending items are correctly identified, attempt counts increment,
 * exhausted items are excluded from pending, and stale entries are pruned.
 */

// Mock MMKV storage before importing anything that uses it
const mockStorage: Record<string, string> = {};
jest.mock('@/store/storage', () => ({
  storage: {
    getString: (key: string) => mockStorage[key] ?? null,
    set: (key: string, value: string) => { mockStorage[key] = value; },
    delete: (key: string) => { delete mockStorage[key]; },
  },
}));

jest.mock('@/utils/constants', () => ({
  STORAGE_KEYS: { METRIC_QUEUE: 'metric_queue' },
}));

import {localQueue} from '@/services/localQueue';
import type {DailyMetrics} from '@/types';

function makeDummyMetrics(date: string): DailyMetrics {
  return {
    metric_date: date,
    steps: 5000,
    sleep_hours: 7,
    sleep_source: 'wearable',
    mood_score: 3,
    communication_count: null,
    resting_heart_rate_bpm: null,
    average_heart_rate_bpm: null,
    hrv_ms: null,
    screen_time_minutes: null,
    location_home_ratio: null,
    location_transitions: null,
    noise_level_db_avg: null,
  };
}

function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

beforeEach(() => {
  // Clear MMKV mock state before each test
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  localQueue.clearAll();
});

describe('localQueue — offline queue retry', () => {
  it('enqueues a metric and returns it as pending', () => {
    const today = pastDate(0);
    localQueue.enqueue(today, makeDummyMetrics(today));
    const pending = localQueue.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].date).toBe(today);
    expect(pending[0].attempts).toBe(0);
  });

  it('marks uploaded items as removed from queue', () => {
    const today = pastDate(0);
    localQueue.enqueue(today, makeDummyMetrics(today));
    localQueue.markUploaded(today);
    expect(localQueue.getPending()).toHaveLength(0);
    expect(localQueue.count()).toBe(0);
  });

  it('increments attempt count on failure', () => {
    const today = pastDate(0);
    localQueue.enqueue(today, makeDummyMetrics(today));
    localQueue.incrementAttempts(today);
    localQueue.incrementAttempts(today);
    const pending = localQueue.getPending();
    expect(pending[0].attempts).toBe(2);
  });

  it('excludes items that have reached max attempts (5) from pending', () => {
    const today = pastDate(0);
    localQueue.enqueue(today, makeDummyMetrics(today));
    for (let i = 0; i < 5; i++) {
      localQueue.incrementAttempts(today);
    }
    expect(localQueue.getPending()).toHaveLength(0);
  });

  it('prunes stale entries older than 7 days', () => {
    const oldDate = pastDate(8);
    const recentDate = pastDate(2);
    localQueue.enqueue(oldDate, makeDummyMetrics(oldDate));
    localQueue.enqueue(recentDate, makeDummyMetrics(recentDate));

    const dropped = localQueue.pruneStale();
    expect(dropped).toContain(oldDate);
    expect(localQueue.count()).toBe(1);
    expect(localQueue.getPending()[0].date).toBe(recentDate);
  });

  it('updates existing entry (same date) without adding a duplicate', () => {
    const today = pastDate(0);
    localQueue.enqueue(today, makeDummyMetrics(today));
    const updated = {...makeDummyMetrics(today), steps: 9999};
    localQueue.enqueue(today, updated);
    expect(localQueue.count()).toBe(1);
    expect(localQueue.getPending()[0].metrics.steps).toBe(9999);
  });

  it('hasStaleEntries returns true when a stale entry exists', () => {
    const oldDate = pastDate(10);
    localQueue.enqueue(oldDate, makeDummyMetrics(oldDate));
    expect(localQueue.hasStaleEntries()).toBe(true);
  });

  it('hasStaleEntries returns false when no stale entries', () => {
    const today = pastDate(0);
    localQueue.enqueue(today, makeDummyMetrics(today));
    expect(localQueue.hasStaleEntries()).toBe(false);
  });
});
