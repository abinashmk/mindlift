/**
 * Google Calendar integration — read-only.
 *
 * Uses @react-native-google-signin/google-signin for OAuth and then calls
 * the Google Calendar REST API directly to avoid a heavy native SDK dep.
 *
 * Required native setup:
 *
 * 1. npm install @react-native-google-signin/google-signin
 *    cd ios && pod install
 *
 * 2. Create a Google Cloud project, enable Calendar API, and create an
 *    OAuth 2.0 Client ID (iOS and/or Android).
 *
 * 3. iOS — add CFBundleURLTypes to ios/<AppName>/Info.plist:
 *      <key>CFBundleURLTypes</key>
 *      <array>
 *        <dict>
 *          <key>CFBundleURLSchemes</key>
 *          <array>
 *            <string>com.googleusercontent.apps.YOUR_CLIENT_ID</string>
 *          </array>
 *        </dict>
 *      </array>
 *
 * 4. Android — place google-services.json in android/app/ and add:
 *      classpath 'com.google.gms:google-services:4.3.15'  (project build.gradle)
 *      apply plugin: 'com.google.gms.google-services'     (app build.gradle)
 *
 * 5. Set WEB_CLIENT_ID in .env (required for offline access / token refresh):
 *      GOOGLE_WEB_CLIENT_ID=xxxx.apps.googleusercontent.com
 */

import {GoogleSignin, statusCodes} from '@react-native-google-signin/google-signin';
import Config from 'react-native-config';

const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

// Lazy-init guard so configure() is only called once
let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: Config.GOOGLE_WEB_CLIENT_ID ?? '',
    iosClientId: Config.GOOGLE_IOS_CLIENT_ID ?? '',
    scopes: CALENDAR_SCOPES,
    offlineAccess: false,
  });
  configured = true;
}

// ─── Sign in / out ────────────────────────────────────────────────────────────

/** Returns the signed-in user's email, or throws if cancelled / failed. */
export async function signInToGoogle(): Promise<string> {
  ensureConfigured();
  const response = await GoogleSignin.signIn();
  if (response.type === 'cancelled') {
    throw Object.assign(new Error('Sign-in cancelled'), {code: '12501'});
  }
  return response.data.user.email;
}

/** Signs out and revokes the Calendar access grant. */
export async function signOutFromGoogle(): Promise<void> {
  ensureConfigured();
  try {
    await GoogleSignin.revokeAccess();
    await GoogleSignin.signOut();
  } catch (err) {
    console.warn('[calendarService] signOut error:', err);
  }
}

/** Returns the signed-in user's email if a session exists, or null. */
export async function restoreGoogleSession(): Promise<string | null> {
  ensureConfigured();
  try {
    const response = await GoogleSignin.signInSilently();
    if (response.type === 'cancelled' || response.type === 'noSavedCredentialFound') {
      return null;
    }
    return response.data.user.email;
  } catch (err: any) {
    if (err.code === statusCodes.SIGN_IN_REQUIRED) return null;
    console.warn('[calendarService] silentSignIn error:', err);
    return null;
  }
}

// ─── Calendar fetch ───────────────────────────────────────────────────────────

interface CalendarEvent {
  start: {dateTime?: string; date?: string};
  end: {dateTime?: string; date?: string};
  summary?: string;
  status?: string;
}

/**
 * Fetch today's calendar events and return total duration of accepted/confirmed
 * meetings in decimal hours, capped at 24.
 *
 * Only counts events that have explicit start + end dateTimes (i.e. not
 * all-day events) and are not cancelled.
 */
export async function fetchTodayMeetingHours(): Promise<number> {
  ensureConfigured();

  const tokens = await GoogleSignin.getTokens();
  const accessToken = tokens.accessToken;

  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0, 0, 0, 0,
  );
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23, 59, 59, 999,
  );

  const params = new URLSearchParams({
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    {
      headers: {Authorization: `Bearer ${accessToken}`},
    },
  );

  if (!response.ok) {
    throw new Error(`Calendar API error: ${response.status}`);
  }

  const data: {items?: CalendarEvent[]} = await response.json();
  const events = data.items ?? [];

  let totalMs = 0;
  for (const event of events) {
    if (event.status === 'cancelled') continue;
    const startStr = event.start?.dateTime;
    const endStr = event.end?.dateTime;
    if (!startStr || !endStr) continue; // skip all-day events

    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    if (end > start) {
      totalMs += end - start;
    }
  }

  const hours = totalMs / (1000 * 60 * 60);
  return Math.min(parseFloat(hours.toFixed(2)), 24);
}
