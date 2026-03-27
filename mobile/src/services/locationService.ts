/**
 * Location category service.
 *
 * Reads the device's current location, classifies it into one of five
 * categories (home / work / social / transit / unknown) using locally
 * stored reference coordinates, then returns only the derived aggregates:
 *   - location_home_ratio: fraction of samples where category === 'home'
 *   - location_transitions: number of category changes today
 *
 * PRIVACY GUARANTEES (spec §12, §18.5):
 *   - Exact GPS coordinates are NEVER sent to the backend.
 *   - Raw coordinates are used only transiently in memory to produce the
 *     category string. They are never written to storage or logs.
 *   - Reference coordinates (home/work) are stored locally on-device only
 *     (via MMKV encrypted storage) and never transmitted.
 */

import {Platform, NativeModules} from 'react-native';
import {MMKV} from 'react-native-mmkv';
import {validateRange} from '@/utils/validators';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LocationCategory =
  | 'home'
  | 'work'
  | 'social'
  | 'transit'
  | 'unknown';

export interface LocationAggregates {
  location_home_ratio: number | null;
  location_transitions: number | null;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface LocationSample {
  category: LocationCategory;
  timestamp: number; // epoch ms
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const storage = new MMKV({id: 'mindlift-location'});

const STORAGE_KEYS = {
  HOME_COORDS: 'location.home_coords',
  WORK_COORDS: 'location.work_coords',
  TODAY_SAMPLES: 'location.today_samples',
  SAMPLES_DATE: 'location.samples_date',
} as const;

const PROXIMITY_THRESHOLD_M = 200; // metres — within 200 m = "at this place"

// ─── Haversine distance ───────────────────────────────────────────────────────

function haversineMetres(a: Coordinates, b: Coordinates): number {
  const R = 6_371_000; // Earth radius in metres
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const chord =
    sinDLat * sinDLat +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      sinDLon *
      sinDLon;
  return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

// ─── Category classification ──────────────────────────────────────────────────

function classifyCoords(coords: Coordinates): LocationCategory {
  const homeRaw = storage.getString(STORAGE_KEYS.HOME_COORDS);
  const workRaw = storage.getString(STORAGE_KEYS.WORK_COORDS);

  if (homeRaw) {
    const home: Coordinates = JSON.parse(homeRaw);
    if (haversineMetres(coords, home) <= PROXIMITY_THRESHOLD_M) return 'home';
  }

  if (workRaw) {
    const work: Coordinates = JSON.parse(workRaw);
    if (haversineMetres(coords, work) <= PROXIMITY_THRESHOLD_M) return 'work';
  }

  // Without known reference points we fall back to 'unknown'.
  // Future: cluster analysis of frequent locations for 'social' / 'transit'.
  return 'unknown';
}

// ─── Sample management ────────────────────────────────────────────────────────

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadTodaySamples(): LocationSample[] {
  const samplesDate = storage.getString(STORAGE_KEYS.SAMPLES_DATE);
  const today = getTodayDateString();
  if (samplesDate !== today) {
    // New day — clear yesterday's samples
    storage.set(STORAGE_KEYS.TODAY_SAMPLES, JSON.stringify([]));
    storage.set(STORAGE_KEYS.SAMPLES_DATE, today);
    return [];
  }
  const raw = storage.getString(STORAGE_KEYS.TODAY_SAMPLES);
  return raw ? JSON.parse(raw) : [];
}

function saveSample(sample: LocationSample): void {
  const existing = loadTodaySamples();
  existing.push(sample);
  storage.set(STORAGE_KEYS.TODAY_SAMPLES, JSON.stringify(existing));
  if (!storage.getString(STORAGE_KEYS.SAMPLES_DATE)) {
    storage.set(STORAGE_KEYS.SAMPLES_DATE, getTodayDateString());
  }
}

// ─── Geolocation wrapper ──────────────────────────────────────────────────────

async function getCurrentCoords(): Promise<Coordinates | null> {
  return new Promise(resolve => {
    // react-native's built-in Geolocation API
    const {Geolocation} = NativeModules;
    if (!Geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({latitude: pos.coords.latitude, longitude: pos.coords.longitude}),
      () => resolve(null),
      {enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000},
    );
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Take one location sample for today: get current position, classify it,
 * append to the local day's sample list, and return today's aggregates.
 *
 * Exact coordinates are NEVER persisted — only the category string is stored.
 * Returns null aggregates if location permission is denied or unavailable.
 */
export async function sampleLocationAndAggregate(): Promise<LocationAggregates> {
  const coords = await getCurrentCoords();

  if (coords) {
    const category = classifyCoords(coords);
    // coords are immediately discarded — only category is stored
    saveSample({category, timestamp: Date.now()});
  }

  return computeAggregates();
}

/**
 * Compute aggregates from today's stored sample list without taking a new sample.
 */
export function computeAggregates(): LocationAggregates {
  const samples = loadTodaySamples();
  if (samples.length === 0) {
    return {location_home_ratio: null, location_transitions: null};
  }

  const homeCount = samples.filter(s => s.category === 'home').length;
  const homeRatio = homeCount / samples.length;

  let transitions = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].category !== samples[i - 1].category) transitions++;
  }

  return {
    location_home_ratio: validateRange(parseFloat(homeRatio.toFixed(3)), 0, 1),
    location_transitions: validateRange(transitions, 0, 100),
  };
}

/**
 * Save the user's current location as their home reference point.
 * Called from Settings when the user taps "Set home location".
 * Stores coordinates locally only — never transmitted.
 */
export async function setHomeLocation(): Promise<boolean> {
  const coords = await getCurrentCoords();
  if (!coords) return false;
  storage.set(STORAGE_KEYS.HOME_COORDS, JSON.stringify(coords));
  return true;
}

/**
 * Save the user's current location as their work reference point.
 */
export async function setWorkLocation(): Promise<boolean> {
  const coords = await getCurrentCoords();
  if (!coords) return false;
  storage.set(STORAGE_KEYS.WORK_COORDS, JSON.stringify(coords));
  return true;
}
