// ─── User & Auth ─────────────────────────────────────────────────────────────

export type UserState =
  | 'ONBOARDING'
  | 'ACTIVE'
  | 'LIMITED'
  | 'OFFLINE'
  | 'CRISIS'
  | 'ESCALATED'
  | 'DELETED';

export type RiskLevel = 'UNDEFINED' | 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export type ChatSessionState =
  | 'IDLE'
  | 'CHECK_IN'
  | 'SUPPORT'
  | 'SUGGESTION'
  | 'CRISIS'
  | 'END';

// ─── Metrics ──────────────────────────────────────────────────────────────────

export interface DailyMetrics {
  metric_date: string;
  steps: number | null;
  resting_heart_rate_bpm: number | null;
  average_heart_rate_bpm: number | null;
  hrv_ms: number | null;
  sleep_hours: number | null;
  sleep_source: 'wearable' | 'inferred' | 'manual' | 'unknown' | null;
  screen_time_minutes: number | null;
  location_home_ratio: number | null;
  location_transitions: number | null;
  noise_level_db_avg: number | null;
  mood_score: number | null;
  stress_source: string | null;
  meeting_hours: number | null;
  communication_count: number | null;
}

// ─── Risk ─────────────────────────────────────────────────────────────────────

export interface ContributingFeature {
  feature_key: string;
  current_value: number;
  baseline_mean: number;
  baseline_std: number;
  z_score: number;
  feature_score: number;
}

export interface RiskAssessment {
  assessment_time: string;
  risk_score: number;
  risk_level: RiskLevel;
  baseline_complete: boolean;
  contributing_features: ContributingFeature[];
}

export interface RiskHistoryItem {
  date: string;
  risk_level: RiskLevel;
  risk_score: number;
}

// ─── Interventions ────────────────────────────────────────────────────────────

export type InterventionStatus =
  | 'TRIGGERED'
  | 'VIEWED'
  | 'COMPLETED'
  | 'DISMISSED'
  | 'EXPIRED';

export interface InterventionEvent {
  event_id: string;
  code: string;
  name: string;
  duration_minutes: number;
  instructions_markdown: string;
  status: InterventionStatus;
  triggered_at: string;
  suggested_reason?: string;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  sender_type: 'user' | 'assistant' | 'system';
  message_text: string | null;
  created_at: string;
}

export interface ChatSession {
  session_id: string;
  state: ChatSessionState;
  crisis_flag: boolean;
  started_at: string;
}

export interface ChatMessageResponse {
  message: ChatMessage;
  session: ChatSession;
  assistant_message: ChatMessage;
}

// ─── Consent ──────────────────────────────────────────────────────────────────

export interface ConsentPayload {
  terms_of_service: boolean;
  privacy_policy: boolean;
  data_collection: boolean;
  chat_logging: boolean;
  health_data_accepted: boolean;
  location_category_accepted: boolean;
  noise_level_accepted: boolean;
}

// ─── Escalation ───────────────────────────────────────────────────────────────

export interface EscalationContact {
  contact_id: string;
  name: string;
  phone: string;
  relationship: string;
}

export interface EscalationContactPayload {
  name: string;
  phone: string;
  relationship: string;
}

// ─── Devices ──────────────────────────────────────────────────────────────────

export interface DeviceRegistrationPayload {
  platform: 'ios' | 'android';
  push_token: string | null;
  permissions: {
    motion: boolean;
    notifications: boolean;
    health: boolean;
    location: boolean;
    microphone: boolean;
  };
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginResponse {
  temp_session_token: string;
  mfa_required: boolean;
}

export interface MfaResponse {
  access_token: string;
  refresh_token: string;
  user_state: UserState;
  user_id: string;
  first_name: string;
}

export interface UserProfile {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  user_state: UserState;
  timezone: string;
  created_at: string;
}

export interface DailyGoal {
  key: string;
  label: string;
  done: boolean;
  detail: string;
}

export interface HomeData {
  risk_assessment: RiskAssessment | null;
  today_metrics: Partial<DailyMetrics> | null;
  suggested_intervention: InterventionEvent | null;
  recent_risk_history: RiskHistoryItem[];
  daily_goals: DailyGoal[];
}

// ─── Offline Queue ────────────────────────────────────────────────────────────

export interface QueuedMetric {
  date: string;
  metrics: DailyMetrics;
  attempts: number;
  queued_at: string;
}

// ─── Permissions ──────────────────────────────────────────────────────────────

export interface PermissionResults {
  motion: boolean;
  notifications: boolean;
  health: boolean;
  location: boolean;
  microphone: boolean;
}

// ─── Navigation Params ────────────────────────────────────────────────────────

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Onboarding: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  EmailVerification: {email: string};
  Mfa: {tempSessionToken: string};
};

export type OnboardingStackParamList = {
  OnboardingIntro: undefined;
  Consent: undefined;
  PermissionSetup: {consentPayload: ConsentPayload};
  TrustedContact: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Insights: undefined;
  Chat: undefined;
  Settings: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  InterventionsList: undefined;
  InterventionDetail: {eventId: string};
  Crisis: undefined;
  ExportRequested: {taskId: string};
  DeletionRequested: undefined;
  ConsentUpdate: undefined;
};
