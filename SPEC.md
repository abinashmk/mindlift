# MindLift Engineer Execution Specification
## Clinical-Adjacent Mental-Health Early-Intervention Copilot
## Zero-Assumption Build Manual

---

# 1. Document Purpose

This document is the complete implementation specification for the MindLift system.

It is written so that a software engineer, product designer, QA engineer, DevOps engineer, or technical project manager with no prior exposure to this product can build the application and supporting systems without making product-level assumptions.

This document defines:

- product purpose
- product boundaries
- user roles
- supported platforms
- architecture
- data model
- API contracts
- mobile workflows
- dashboard workflows
- risk scoring logic
- intervention logic
- AI chat logic
- crisis handling
- support escalation
- visual structure
- permissions
- error handling
- testing
- deployment
- release criteria

If a behavior is described here, it must be implemented exactly as written.

If a behavior is not described here, the engineer must choose the simplest implementation that does not conflict with any rule in this document and must document that choice in the repository README.

---

# 2. Product Definition

## 2.1 Product Name

**MindLift**

## 2.2 Product Category

MindLift is a **clinical-adjacent mental-health early-intervention support system**.

It is not a diagnostic system.
It is not a psychotherapy system.
It is not a crisis counseling system.
It is not a replacement for a licensed clinician.
It may collect behavioral and physiological indicators and use them to identify deviations from baseline and recommend low-risk, non-clinical support actions.

## 2.3 Product Purpose

MindLift exists to do all of the following:

- collect user-consented behavioral and physiological data from smartphone and approved OS-level health integrations
- learn an individual baseline
- detect deviations from that baseline
- compute a risk level
- offer brief, safe, non-clinical interventions
- provide bounded AI-assisted supportive chat
- stop normal chat and escalate when crisis-like language or high-risk states occur
- allow a human support team to review and respond to escalations

## 2.4 Product Non-Purpose

MindLift must not do any of the following:

- diagnose depression, anxiety, bipolar disorder, PTSD, psychosis, or any clinical condition
- provide treatment plans
- provide medication recommendations
- present itself as a therapist, doctor, counselor, psychiatrist, psychologist, or emergency service
- continue ordinary AI chat after crisis detection
- store raw microphone audio
- store exact GPS coordinates on the backend
- read SMS or call message content
- scrape data from third-party apps beyond OS-approved APIs and explicit user action

---

# 3. Supported Users, Roles, and Platforms

## 3.1 End Users

End users are adults age 18+ who are using the app for self-monitoring and support.

## 3.2 Internal Roles

The system must support the following authenticated internal roles:

1. `support_agent`
2. `support_manager`
3. `admin`
4. `read_only_auditor`

## 3.3 Platform Support

### Mobile App
- iOS 15 or later
- Android 10 or later

### Web Support Dashboard
- latest stable Chrome
- latest stable Edge
- latest stable Safari

---

# 4. Regulatory and Safety Positioning

## 4.1 User-Facing Positioning

The app must show the following exact text during onboarding, in settings, and before first AI chat use:

> MindLift is a self-management and support tool. It does not diagnose medical or mental-health conditions and does not replace a licensed clinician or emergency services.

The app must show the following exact AI disclosure when a user enters chat for the first time and whenever chat history is cleared:

> You are chatting with an AI assistant. It can offer general support and coping suggestions, but it cannot provide therapy, diagnosis, or emergency help.

## 4.2 Crisis Positioning

If crisis language or crisis classifier triggers are detected, the app must show:

> I’m concerned you may be in immediate distress. I cannot provide crisis support here. Please contact emergency services or a crisis hotline.

## 4.3 Region Scope

This version is **US-only**.

Crisis actions and resource logic must only assume:

- 911
- 988
- trusted contact
- internal support escalation

No international hotline logic is required in version 1.

---

# 5. Product Scope

## 5.1 Included in Scope

- user registration
- login
- MFA
- consent capture
- motion data usage
- notifications
- optional health integration
- optional generalized location categorization
- optional ambient noise level aggregation
- baseline learning
- daily metric upload
- risk score computation
- intervention selection
- intervention completion tracking
- supportive AI chat
- crisis detection and forced stop
- escalation packet creation
- support dashboard
- export
- account deletion

## 5.2 Explicitly Out of Scope

- direct Bluetooth wearable integrations beyond OS-approved health frameworks
- peer community
- public forums
- social feed
- telehealth video
- clinician note-taking system
- diagnostic questionnaires that produce diagnoses
- insurance billing
- claims handling
- internationalization
- multilingual UI
- family accounts
- minor users
- reinforcement learning
- autonomous clinical decision making

---

# 6. Technical Stack

## 6.1 Mobile App
- React Native
- TypeScript
- React Navigation
- Redux Toolkit
- encrypted local SQLite storage
- native wrappers for HealthKit and Health Connect as needed

## 6.2 Backend
- Python 3.11
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic

## 6.3 Async Processing
- Celery
- Redis 7

## 6.4 Database
- PostgreSQL 15

## 6.5 Web Dashboard
- React
- TypeScript
- component library may be chosen by implementer but must satisfy accessibility and visual rules in this document

## 6.6 Infrastructure
- Docker
- docker-compose for local development
- AWS for deployed environments:
  - EC2
  - RDS PostgreSQL
  - ElastiCache Redis
  - S3
  - CloudWatch
  - Secrets Manager
  - ALB

---

# 7. Environment Model

## 7.1 Environments

1. local
2. dev
3. staging
4. production

## 7.2 Domain Naming

- `api-dev.mindlift.app`
- `api-staging.mindlift.app`
- `api.mindlift.app`
- `dashboard-staging.mindlift.app`
- `dashboard.mindlift.app`

---

# 8. User Eligibility and Access Rules

## 8.1 Eligibility Rules

A user account may only be activated if all of the following are true:

- user self-confirms age 18+
- email is verified
- required consents are accepted
- app is running on supported OS version

## 8.2 Underage Handling

If the user indicates age below 18, registration must be blocked and the app must display:

> This app is currently available only to adults age 18 and older.

No partial account should be created in the active users table for underage users. A temporary registration attempt log may be stored for abuse prevention, but not a full account.

---

# 9. State Model

## 9.1 User State Enum

Allowed user states:

- `ONBOARDING`
- `ACTIVE`
- `LIMITED`
- `OFFLINE`
- `CRISIS`
- `ESCALATED`
- `DELETED`

## 9.2 State Meaning

### ONBOARDING
The user has an account but has not completed required onboarding.

### ACTIVE
The user has completed required onboarding and required permissions.

### LIMITED
The user has completed onboarding but one or more required capabilities are missing.

### OFFLINE
The user has not successfully synced in the defined offline threshold.

### CRISIS
Crisis flow has been triggered. Chat input must stop.

### ESCALATED
An escalation has been created and user has been routed into elevated support handling.

### DELETED
Deletion request has completed. Authentication must fail.

## 9.3 Required Permissions for ACTIVE

These are required for full ACTIVE state:

- motion/activity access
- notifications enabled

If either is missing, user state must be `LIMITED`.

## 9.4 Optional Permissions

These permissions are optional and must not block onboarding completion:

- health integration
- generalized location category
- ambient noise level

## 9.5 State Transition Rules

- `ONBOARDING -> ACTIVE` when email verified, required consent accepted, and required permissions present
- `ONBOARDING -> LIMITED` when onboarding complete but required permissions missing
- `ACTIVE -> LIMITED` when required permissions are later revoked
- `LIMITED -> ACTIVE` when missing required permissions are restored
- `ACTIVE -> OFFLINE` when no successful backend sync has occurred for 24 hours
- `LIMITED -> OFFLINE` when no successful backend sync has occurred for 24 hours
- `OFFLINE -> ACTIVE` when sync succeeds and required permissions are present
- `OFFLINE -> LIMITED` when sync succeeds but required permissions are missing
- `ANY NON-DELETED STATE -> CRISIS` on crisis classifier or explicit crisis trigger
- `CRISIS -> ESCALATED` when escalation record is successfully created
- `ANY STATE -> DELETED` after successful delete workflow completion

## 9.6 Crisis Override Rule

If a user is in `CRISIS`, chat input must be disabled regardless of any other state.

---

# 10. Consent Model

## 10.1 Required Consents

The following must be captured as discrete consent records:

- `terms_accepted`
- `privacy_policy_accepted`
- `data_collection_accepted`
- `chat_logging_accepted`

The following is required only if the user adds a trusted contact:
- `escalation_contact_accepted`

## 10.2 Optional Consents

- `health_data_accepted`
- `location_category_accepted`
- `noise_level_accepted`

## 10.3 Consent Storage Requirements

Each consent must be stored as a separate record with:

- user ID
- consent key
- consent value
- policy version
- timestamp

## 10.4 Consent Revocation Rules

When optional consent is revoked:

- stop future collection immediately
- stop future upload immediately
- exclude revoked data types from future risk calculations
- keep previously stored data until export or deletion unless legal policy requires otherwise

When `chat_logging_accepted` is false:

- do not persist chat message text
- do persist crisis classifier results and message-length metadata
- do persist escalation packet references

---

# 11. Authentication and Session Rules

## 11.1 Auth Methods

Supported auth methods:

- email + password
- MFA using email OTP or authenticator app OTP

No social login in version 1.

## 11.2 Password Rules

Password must satisfy all of the following:

- minimum 12 characters
- at least 1 uppercase letter
- at least 1 lowercase letter
- at least 1 digit
- at least 1 special character

## 11.3 Token Rules

- access token lifetime: 15 minutes
- refresh token lifetime: 30 days
- app idle timeout: 30 minutes of inactivity

## 11.4 Password Reset Rules

- password reset via one-time email link
- link valid for 30 minutes
- link usable exactly once

## 11.5 Biometrics

Biometric unlock may be used only for local device session unlock after prior successful login. Biometrics must not bypass backend authentication requirements for first login on a device.

---

# 12. Data Minimization Rules

The backend must never store:

- raw microphone audio
- exact GPS coordinates
- raw keystrokes
- SMS content
- call content
- photo library content
- contact list contents

The device may temporarily process raw signals locally when necessary to derive allowed aggregates.

---

# 13. Allowed Data Sources

## 13.1 Required

- motion/activity data
- notification capability
- user-entered mood

## 13.2 Optional

- HealthKit / Health Connect metrics
- generalized location categories
- ambient noise levels
- user-entered communication count

## 13.3 Not Allowed

- direct reading of private app content
- hidden background scraping
- device contact names upload
- exact transcript extraction from messages

---

# 14. Time and Units

## 14.1 Timestamp Standard

All backend timestamps must be ISO 8601 UTC with trailing `Z`.

All frontend timestamps must be rendered in local device timezone.

## 14.2 Value Ranges

- `steps`: integer, 0 to 100000 inclusive
- `resting_heart_rate_bpm`: float, 20.0 to 220.0 inclusive
- `average_heart_rate_bpm`: float, 20.0 to 220.0 inclusive
- `hrv_ms`: float, 0.0 to 500.0 inclusive
- `sleep_hours`: float, 0.0 to 24.0 inclusive
- `screen_time_minutes`: integer, 0 to 1440 inclusive
- `noise_level_db_avg`: float, 0.0 to 140.0 inclusive
- `mood_score`: integer, 1 to 5 inclusive
- `location_home_ratio`: float, 0.0 to 1.0 inclusive
- `location_transitions`: integer, 0 to 100 inclusive
- `communication_count`: integer, 0 to 500 inclusive

## 14.3 Invalid Value Handling

Backend ingestion must reject out-of-range values with HTTP 422.

Local derived values that exceed valid range must be converted to `null` before upload.

No API layer clamping is allowed.

---

# 15. Database Schema

The following schema must be implemented exactly.

## 15.1 Table: users

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(320) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    age_confirmed_18_plus BOOLEAN NOT NULL,
    first_name VARCHAR(100),
    timezone VARCHAR(100) NOT NULL,
    state VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ
);
```

## 15.2 Table: user_consents

```sql
CREATE TABLE user_consents (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_key VARCHAR(100) NOT NULL,
    consent_value BOOLEAN NOT NULL,
    policy_version VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX idx_user_consents_key ON user_consents(consent_key);
```

## 15.3 Table: devices

```sql
CREATE TABLE devices (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(20) NOT NULL,
    os_version VARCHAR(50) NOT NULL,
    app_version VARCHAR(50) NOT NULL,
    push_token TEXT,
    notifications_enabled BOOLEAN NOT NULL,
    motion_permission BOOLEAN NOT NULL,
    health_permission BOOLEAN NOT NULL,
    location_permission BOOLEAN NOT NULL,
    noise_permission BOOLEAN NOT NULL,
    biometric_enabled BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_devices_user_id ON devices(user_id);
```

## 15.4 Table: daily_metrics

```sql
CREATE TABLE daily_metrics (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    steps INTEGER,
    resting_heart_rate_bpm DOUBLE PRECISION,
    average_heart_rate_bpm DOUBLE PRECISION,
    hrv_ms DOUBLE PRECISION,
    sleep_hours DOUBLE PRECISION,
    sleep_source VARCHAR(20),
    screen_time_minutes INTEGER,
    location_home_ratio DOUBLE PRECISION,
    location_transitions INTEGER,
    noise_level_db_avg DOUBLE PRECISION,
    mood_score INTEGER,
    communication_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE(user_id, metric_date)
);

CREATE INDEX idx_daily_metrics_user_date ON daily_metrics(user_id, metric_date);
```

## 15.5 Table: baselines

```sql
CREATE TABLE baselines (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature_key VARCHAR(100) NOT NULL,
    mean_value DOUBLE PRECISION NOT NULL,
    std_value DOUBLE PRECISION NOT NULL,
    valid_days INTEGER NOT NULL,
    baseline_start_date DATE NOT NULL,
    baseline_end_date DATE NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE(user_id, feature_key)
);
```

## 15.6 Table: risk_assessments

```sql
CREATE TABLE risk_assessments (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assessment_time TIMESTAMPTZ NOT NULL,
    assessment_scope VARCHAR(20) NOT NULL,
    risk_score DOUBLE PRECISION NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    feature_sleep_score DOUBLE PRECISION,
    feature_activity_score DOUBLE PRECISION,
    feature_heart_score DOUBLE PRECISION,
    feature_social_score DOUBLE PRECISION,
    contributing_features JSONB NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    baseline_complete BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_risk_assessments_user_time ON risk_assessments(user_id, assessment_time DESC);
```

## 15.7 Table: interventions

```sql
CREATE TABLE interventions (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    instructions_markdown TEXT NOT NULL,
    contraindications JSONB NOT NULL,
    active BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
```

## 15.8 Table: intervention_events

```sql
CREATE TABLE intervention_events (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    intervention_id UUID NOT NULL REFERENCES interventions(id),
    triggered_at TIMESTAMPTZ NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    completed BOOLEAN,
    helpful_rating INTEGER,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
```

## 15.9 Table: chat_sessions

```sql
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    state VARCHAR(20) NOT NULL,
    crisis_flag BOOLEAN NOT NULL DEFAULT FALSE
);
```

## 15.10 Table: chat_messages

```sql
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL,
    message_text TEXT,
    message_length INTEGER,
    classifier_result JSONB,
    created_at TIMESTAMPTZ NOT NULL
);
```

## 15.11 Table: escalation_contacts

```sql
CREATE TABLE escalation_contacts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_name VARCHAR(200) NOT NULL,
    contact_phone VARCHAR(50) NOT NULL,
    relationship VARCHAR(100) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
```

## 15.12 Table: escalations

```sql
CREATE TABLE escalations (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    packet JSONB NOT NULL,
    assigned_agent_id UUID,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_escalations_status ON escalations(status);
CREATE INDEX idx_escalations_created_at ON escalations(created_at DESC);
```

## 15.13 Table: support_users

```sql
CREATE TABLE support_users (
    id UUID PRIMARY KEY,
    email VARCHAR(320) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL,
    mfa_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
```

## 15.14 Table: audit_logs

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    actor_type VARCHAR(30) NOT NULL,
    actor_id UUID,
    action_key VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    metadata JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

---

# 16. Enum Definitions

## 16.1 users.state
- `ONBOARDING`
- `ACTIVE`
- `LIMITED`
- `OFFLINE`
- `CRISIS`
- `ESCALATED`
- `DELETED`

## 16.2 devices.platform
- `ios`
- `android`

## 16.3 daily_metrics.sleep_source
- `wearable`
- `inferred`
- `manual`
- `unknown`

## 16.4 risk_assessments.assessment_scope
- `daily`
- `intraday`

## 16.5 risk_assessments.risk_level
- `UNDEFINED`
- `GREEN`
- `YELLOW`
- `ORANGE`
- `RED`

## 16.6 interventions.type
- `walk`
- `breathing`
- `sleep_hygiene`
- `grounding`
- `social_nudge`

## 16.7 intervention_events.status
- `TRIGGERED`
- `VIEWED`
- `COMPLETED`
- `DISMISSED`
- `EXPIRED`

## 16.8 chat_sessions.state
- `IDLE`
- `CHECK_IN`
- `SUPPORT`
- `SUGGESTION`
- `CRISIS`
- `END`

## 16.9 chat_messages.sender_type
- `user`
- `assistant`
- `system`

## 16.10 escalations.source
- `risk_engine`
- `crisis_classifier`
- `manual_user_request`
- `support_agent`

## 16.11 escalations.status
- `NEW`
- `ACK`
- `IN_PROGRESS`
- `RESOLVED`
- `CLOSED_NO_ACTION`

## 16.12 support_users.role
- `support_agent`
- `support_manager`
- `admin`
- `read_only_auditor`

---

# 17. Seed Intervention Library

The system must seed the following interventions exactly.

## 17.1 WALK_5

- code: `WALK_5`
- name: `5-Minute Walk`
- type: `walk`
- duration_minutes: `5`
- contraindications: `["mobility_issue", "user_marked_not_safe_to_walk"]`

Instructions markdown:

```markdown
1. Stand up slowly.
2. Walk at a comfortable pace for 5 minutes.
3. Breathe normally.
4. When done, return and rate whether it helped.
```

## 17.2 BREATHE_3

- code: `BREATHE_3`
- name: `3-Minute Breathing Reset`
- type: `breathing`
- duration_minutes: `3`
- contraindications: `["none"]`

Instructions markdown:

```markdown
1. Sit down.
2. Inhale for 4 seconds.
3. Exhale for 6 seconds.
4. Repeat for 3 minutes.
```

## 17.3 SLEEP_CHECK

- code: `SLEEP_CHECK`
- name: `Sleep Setup Reminder`
- type: `sleep_hygiene`
- duration_minutes: `2`
- contraindications: `["none"]`

Instructions markdown:

```markdown
1. Dim lights.
2. Put the phone away.
3. Reduce noise.
4. Start your bedtime routine now.
```

## 17.4 GROUND_54321

- code: `GROUND_54321`
- name: `5-4-3-2-1 Grounding`
- type: `grounding`
- duration_minutes: `4`
- contraindications: `["none"]`

Instructions markdown:

```markdown
1. Name 5 things you see.
2. Name 4 things you can touch.
3. Name 3 things you hear.
4. Name 2 things you smell.
5. Name 1 thing you taste.
```

## 17.5 SOCIAL_TEXT

- code: `SOCIAL_TEXT`
- name: `Send One Friendly Message`
- type: `social_nudge`
- duration_minutes: `3`
- contraindications: `["user_opted_out_social"]`

Instructions markdown:

```markdown
1. Choose one person you trust.
2. Send a short friendly message.
3. Do not wait for a perfect message.
4. Mark complete after sending.
```

---

# 18. Mobile Data Collection Logic

## 18.1 Collection Principles

- collect only user-consented signals
- aggregate on device whenever possible
- upload only aggregated values
- preserve battery
- do not collect unsupported signals using hacks

## 18.2 Polling Modes

- `HIGH` = every 60 seconds
- `MEDIUM` = every 300 seconds
- `LOW` = every 900 seconds

Default mode: `MEDIUM`

## 18.3 Polling Adjustment Rules

- if battery < 15 percent, force `LOW`
- if OS low-power mode is enabled, force `LOW`
- if app is backgrounded, double current interval
- if app is force-killed, do not attempt collection until next launch
- if offline, queue aggregated data locally and retry every 10 minutes

## 18.4 Local Queue Overflow Rule

If local unsynced queue exceeds 7 calendar days:

- drop oldest unsynced metric days first
- create local warning log
- show unobtrusive in-app warning on next launch:
  > Some older unsynced data could not be uploaded because your device was offline too long.

## 18.5 Metric Collection Rules

### Steps
- collect from motion APIs and/or HealthKit / Health Connect when available
- upload daily total only

### Heart Data
- collect only through OS-approved health frameworks
- if unavailable, send `null`

### Sleep
Preferred source:
- wearable sleep data through OS-approved framework

Fallback inferred sleep logic:
- continuous screen-off duration >= 4 hours
- no meaningful motion during that period
- inferred sleep_hours = contiguous inactive period length capped at 12 hours
- if conditions not met, sleep_hours = `null`

### Screen Time
- collect from supported OS aggregate usage APIs when available
- if unavailable, send `null`

### Location Category
- exact raw coordinates may be used locally only long enough to categorize state
- backend must receive only derived aggregates
- local categories:
  - `home`
  - `work`
  - `social`
  - `transit`
  - `unknown`
- backend uploads:
  - `location_home_ratio`
  - `location_transitions`

### Ambient Noise
- collect decibel-like aggregate only
- do not store raw audio
- if permission denied or unsupported, send `null`

### Communication Count
- user-entered only
- no private content access
- can be omitted

### Mood
- user-entered only
- scale 1 to 5

---

# 19. Baseline Logic

## 19.1 Baseline Duration

Baseline learning period = 14 calendar days beginning on the first full calendar day after onboarding completion.

## 19.2 Baseline Completeness Rules

- fewer than 7 valid days => risk level must be `UNDEFINED`
- 7 to 9 valid days => partial baseline allowed
- 10 or more valid days => full weighted risk allowed

## 19.3 Valid Day Definition

A day is valid if data exists for at least 2 of the following 4 feature groups:

- sleep
- activity
- heart
- social

## 19.4 Feature Group Definitions

### Sleep Group
- `sleep_hours`

### Activity Group
- `steps`
- `screen_time_minutes`

### Heart Group
- `resting_heart_rate_bpm` or `average_heart_rate_bpm`
- `hrv_ms`

### Social Group
- `location_home_ratio`
- `location_transitions`
- `mood_score`
- `communication_count`

## 19.5 Baseline Statistics

For each feature key:

- mean = arithmetic average across valid baseline values
- std = sample standard deviation
- if std = 0, replace std with `0.01`

## 19.6 Baseline Update After Initial Period

After baseline completion:

- recompute nightly using trailing 28 valid days
- exclude any day whose highest recorded risk level was `RED`

---

# 20. Feature Scoring Logic

## 20.1 Z-Score Formula

For each feature:

`z = (current_value - baseline_mean) / baseline_std`

## 20.2 Sleep Feature Score

Input:
- `sleep_hours`

Rules:
- if z >= -1 => score 0
- if -2 < z < -1 => score 0.5
- if z <= -2 => score 1

## 20.3 Activity Feature Score

Inputs:
- `steps`
- `screen_time_minutes`

Sub-scores:

### Steps
- if z >= -1 => 0
- if -2 < z < -1 => 0.5
- if z <= -2 => 1

### Screen Time
- if z <= 1 => 0
- if 1 < z < 2 => 0.5
- if z >= 2 => 1

Activity score = average of available activity sub-scores.

## 20.4 Heart Feature Score

Inputs:
- `average_heart_rate_bpm` or `resting_heart_rate_bpm`
- `hrv_ms`

Sub-scores:

### Heart Rate
- if z <= 1 => 0
- if 1 < z < 2 => 0.5
- if z >= 2 => 1

### HRV
- if z >= -1 => 0
- if -2 < z < -1 => 0.5
- if z <= -2 => 1

Heart score = average of available sub-scores.

## 20.5 Social Feature Score

Inputs:
- `location_home_ratio`
- `location_transitions`
- `mood_score`
- `communication_count`

Sub-score rules:

### location_home_ratio
- if z <= 1 => 0
- if 1 < z < 2 => 0.5
- if z >= 2 => 1

### location_transitions
- if z >= -1 => 0
- if -2 < z < -1 => 0.5
- if z <= -2 => 1

### mood_score
- if z >= -1 => 0
- if -2 < z < -1 => 0.5
- if z <= -2 => 1

### communication_count
- if z >= -1 => 0
- if -2 < z < -1 => 0.5
- if z <= -2 => 1

Social score = average of available social sub-scores.

---

# 21. Risk Score Logic

## 21.1 Base Weights

- sleep = 0.30
- activity = 0.20
- heart = 0.30
- social = 0.20

## 21.2 Missing Feature Redistribution

If one or more feature groups are unavailable, redistribute weights proportionally across available feature groups.

Example:
- if heart unavailable, remaining weights become:
  - sleep = 0.30 / 0.70 = 0.428571...
  - activity = 0.20 / 0.70 = 0.285714...
  - social = 0.20 / 0.70 = 0.285714...

## 21.3 Risk Formula

`risk_score = weighted sum of available feature scores`

Round final result to 2 decimal places.

Clamp only final risk_score to [0.00, 1.00].

## 21.4 Risk Level Mapping

- `0.00` to `0.29` => `GREEN`
- `0.30` to `0.59` => `YELLOW`
- `0.60` to `0.79` => `ORANGE`
- `0.80` to `1.00` => `RED`

## 21.5 Escalation Rules

Create escalation if any of the following are true:

- one `RED` assessment exists
- `ORANGE` occurs for 3 consecutive daily assessments
- user presses manual “I need help”
- crisis classifier positive

## 21.6 Contributing Features JSON Format

`contributing_features` must be an array of objects with this schema:

```json
[
  {
    "feature_key": "sleep_hours",
    "current_value": 5.2,
    "baseline_mean": 7.3,
    "baseline_std": 0.8,
    "z_score": -2.625,
    "feature_score": 1.0
  }
]
```

---

# 22. Intervention Selection Logic

## 22.1 General Principles

- interventions must be safe, brief, non-clinical
- interventions must not be triggered during crisis mode
- the same intervention code must not auto-trigger more than once in 24 hours

## 22.2 GREEN Logic

- create no intervention event automatically

## 22.3 YELLOW Logic

Create exactly 1 intervention.

Priority:
1. if sleep feature score is highest => `SLEEP_CHECK`
2. else if activity feature score is highest => `WALK_5`
3. else => `BREATHE_3`

## 22.4 ORANGE Logic

Create exactly 2 interventions.

First intervention:
- same priority logic as YELLOW

Second intervention:
- choose `GROUND_54321`
- if `GROUND_54321` already auto-triggered in last 48 hours, choose `SOCIAL_TEXT`
- if user opted out of social suggestions, and `GROUND_54321` unavailable by cooldown, choose `BREATHE_3`

## 22.5 RED Logic

- create no standard intervention
- create escalation only

## 22.6 Intervention Expiration

- any dismissed intervention expires at local end-of-day
- unviewed triggered interventions expire at local end-of-day
- completed interventions remain in history

---

# 23. AI Chat Specification

## 23.1 Purpose

AI chat exists to provide bounded, supportive, non-clinical conversation.

It may:
- reflect feelings
- suggest safe coping actions
- ask structured follow-up questions

It may not:
- diagnose
- prescribe
- provide treatment plans
- claim to be human
- offer crisis counseling

## 23.2 Session States

- `IDLE`
- `CHECK_IN`
- `SUPPORT`
- `SUGGESTION`
- `CRISIS`
- `END`

## 23.3 Allowed Reply Structure

Every non-crisis assistant reply must contain exactly:

1. one reflective statement
2. one concrete non-clinical suggestion
3. one follow-up question

Maximum:
- 3 sentences
- 60 words

## 23.4 Disallowed Phrases

The assistant must never output:
- “I diagnose”
- “You have depression”
- “You have anxiety disorder”
- “Take medication”
- “You don’t need anyone else”
- “I love you”
- “I am always here for you”
- any claim of emergency support capability

## 23.5 Medical Advice Requests

If the user asks for diagnosis or medical advice:
- respond that the assistant cannot provide diagnosis or medical advice
- recommend contacting a licensed professional
- ask one brief question about the user’s next support step

## 23.6 Chat Logging Logic

If `chat_logging_accepted = true`:
- store message text
- store classifier results

If `chat_logging_accepted = false`:
- do not store message text
- store message_length
- store classifier results
- store crisis escalation references if applicable

---

# 24. Crisis Detection Logic

## 24.1 Crisis Trigger Categories

- self-harm
- suicide
- harm_to_others
- psychosis
- extreme_distress
- none

## 24.2 Trigger Rule

If classifier predicts any category other than `none`, trigger crisis mode.

Also trigger crisis mode if rule-based phrase detection finds obvious crisis statements.

## 24.3 Required Crisis Keywords/Phrase Matching Layer

A rule-based layer must detect common high-risk phrases, including examples such as:

- “I want to kill myself”
- “I want to die”
- “I don’t want to live”
- “I’m going to hurt myself”
- “I cut myself”
- “I overdosed”
- “I want to hurt someone”
- “I hear voices telling me”
- “nothing matters and I have a plan”

This phrase list must be configurable server-side.

## 24.4 Crisis Actions

On trigger:

1. create classifier result
2. set session state = `CRISIS`
3. set user state = `CRISIS`
4. create escalation
5. disable chat input
6. route user to crisis screen

No normal assistant text may be generated after crisis trigger in that request.

---

# 25. Crisis Screen Specification

## 25.1 Text

Display exactly:

> I’m concerned you may be in immediate distress. I cannot provide crisis support here. Please contact emergency services or a crisis hotline.

## 25.2 Buttons in Exact Order

1. `Call 911`
2. `Call or text 988`
3. `Contact trusted person`
4. `Message support`

## 25.3 Button Rules

- if device cannot place calls, hide `Call 911` and `Call or text 988`
- if no trusted contact exists, disable `Contact trusted person`
- `Message support` opens internal escalation acknowledgment view, not normal AI chat

## 25.4 Chat Disable Rule

Chat input must remain disabled for the current session until user exits the session. A new session may be created later, but classifier rules must still run on first message.

---

# 26. Escalation Packet

Escalation packet JSON must match this structure exactly:

```json
{
  "user_id": "UUID",
  "timestamp": "ISO_8601_UTC",
  "source": "risk_engine | crisis_classifier | manual_user_request",
  "risk_level": "RED | ORANGE",
  "risk_score": 0.0,
  "last_7_day_summary": {
    "sleep_hours_avg": 0.0,
    "steps_avg": 0,
    "screen_time_avg": 0,
    "mood_avg": 0.0,
    "home_ratio_avg": 0.0
  },
  "last_5_messages": [
    {
      "sender_type": "user | assistant",
      "message_text": "string_or_null",
      "created_at": "ISO_8601_UTC"
    }
  ]
}
```

If fewer than 5 messages exist, include all existing messages.

If chat logging is disabled, use `null` for `message_text` and still include sender type and created_at.

---

# 27. Human Support Dashboard Requirements

## 27.1 support_agent Capabilities

- log in
- complete MFA
- view assigned escalations
- view escalation detail
- acknowledge escalation
- mark in progress
- resolve escalation
- send predefined message templates only
- view last 7-day summary
- view last 5 user chat messages if allowed by policy

## 27.2 support_manager Capabilities

All `support_agent` capabilities plus:

- view unassigned queue
- assign escalation to agent
- reassign escalation
- export escalation audit CSV

## 27.3 admin Capabilities

- manage support users
- deactivate support accounts
- rotate policy version metadata
- view system health dashboard
- view audit logs
- cannot directly impersonate end users

## 27.4 read_only_auditor Capabilities

- view audit logs only

## 27.5 Escalation Status Transition Rules

- `NEW -> ACK`
- `ACK -> IN_PROGRESS`
- `IN_PROGRESS -> RESOLVED`
- `NEW -> CLOSED_NO_ACTION`
- `ACK -> CLOSED_NO_ACTION`

`RESOLVED` and `CLOSED_NO_ACTION` are terminal.

## 27.6 Queue Ordering

Default queue ordering:

1. unresolved `RED` escalations newest first by created_at
2. unresolved `ORANGE` escalations newest first by created_at

---

# 28. Mobile UI Specification

This section defines required screen hierarchy and key layout behavior.

## 28.1 Global Visual Rules

- use calming neutral palette
- support light mode and dark mode
- minimum tappable area 44x44 points
- rounded card radius: 16 px
- page horizontal padding: 16 px
- card internal padding: 16 px
- card vertical gap: 12 px
- section gap: 20 px
- primary CTA height: 48 px
- body line height: comfortable, minimum 1.4x font size
- default app layout width: responsive mobile width
- typography must favor readability over brand flourish

## 28.2 Required Screens

1. Splash
2. Register
3. Login
4. Email Verification Pending
5. MFA Verify
6. Onboarding Intro
7. Consent
8. Permission Setup
9. Trusted Contact
10. Home Dashboard
11. Insights
12. Interventions List
13. Intervention Detail
14. Chat
15. Crisis
16. Settings
17. Export Requested
18. Deletion Requested

## 28.3 Home Dashboard Layout

Order top to bottom:

1. header row
2. today risk card
3. sleep card
4. activity card
5. mood card
6. suggested action card
7. recent insights preview

### Header Row
Contains:
- app greeting
- current date
- settings icon

### Today Risk Card
Contains:
- title: `Today's Status`
- risk color indicator
- risk level label
- plain-language explanation
- last updated timestamp

### Sleep Card
Contains:
- title: `Sleep`
- sleep hours
- baseline comparison text

### Activity Card
Contains:
- title: `Activity`
- steps
- baseline comparison text

### Mood Card
Contains:
- title: `Mood`
- mood score entry or latest value
- reminder CTA if not logged today

### Suggested Action Card
Contains:
- intervention name
- reason line
- CTA `Open`

## 28.4 Empty State Text

If baseline incomplete:
> We are still learning your normal patterns. Risk insights will appear after enough data is collected.

If no interventions today:
> No action is recommended right now.

If optional permissions denied:
> Some insights are limited because optional data access is turned off.

## 28.5 Chat Screen Layout

- top app bar with title `Support Chat`
- disclosure banner if first use
- message list scroll area
- assistant messages left-aligned
- user messages right-aligned
- bottom composer row
- composer disabled during crisis
- persistent `Help` button visible in overflow or footer

## 28.6 Crisis Screen Layout

- top warning icon
- crisis text block
- button stack in required order
- optional support note below buttons

---

# 29. API Contract

All endpoints use JSON.
All endpoints require HTTPS.
All authenticated endpoints use bearer tokens unless explicitly excluded.

## 29.1 POST /v1/auth/register

Auth: none

Request:
```json
{
  "email": "user@example.com",
  "password": "StrongPass!123",
  "age_confirmed_18_plus": true,
  "timezone": "America/Los_Angeles"
}
```

Success response 201:
```json
{
  "user_id": "UUID",
  "email_verification_required": true
}
```

Validation:
- email required and valid format
- password required and must satisfy password rules
- age_confirmed_18_plus must be true
- timezone required

Errors:
- 409 if email already exists
- 422 on validation failure

## 29.2 POST /v1/auth/verify-email

Auth: none

Request:
```json
{
  "token": "string"
}
```

Success response 200:
```json
{
  "verified": true
}
```

## 29.3 POST /v1/auth/login

Auth: none

Request:
```json
{
  "email": "user@example.com",
  "password": "StrongPass!123"
}
```

Success response 200:
```json
{
  "mfa_required": true,
  "temp_session_token": "string"
}
```

Error:
- 401 invalid credentials
- 403 deleted account

## 29.4 POST /v1/auth/mfa/verify

Auth: none

Request:
```json
{
  "temp_session_token": "string",
  "otp_code": "123456"
}
```

Success response 200:
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "user_state": "ONBOARDING"
}
```

## 29.5 POST /v1/auth/refresh

Auth: none

Request:
```json
{
  "refresh_token": "string"
}
```

Success response 200:
```json
{
  "access_token": "string"
}
```

## 29.6 POST /v1/consents

Auth: user bearer token

Request:
```json
{
  "policy_version": "2026-03-22",
  "terms_accepted": true,
  "privacy_policy_accepted": true,
  "data_collection_accepted": true,
  "health_data_accepted": false,
  "location_category_accepted": false,
  "noise_level_accepted": false,
  "chat_logging_accepted": true,
  "escalation_contact_accepted": true
}
```

Success response 200:
```json
{
  "saved": true
}
```

## 29.7 POST /v1/devices/register

Auth: user bearer token

Request:
```json
{
  "platform": "ios",
  "os_version": "17.4",
  "app_version": "1.0.0",
  "push_token": "string",
  "notifications_enabled": true,
  "motion_permission": true,
  "health_permission": false,
  "location_permission": false,
  "noise_permission": false,
  "biometric_enabled": false
}
```

Success response 200:
```json
{
  "device_id": "UUID"
}
```

## 29.8 POST /v1/escalation-contacts

Auth: user bearer token

Request:
```json
{
  "contact_name": "Alex Doe",
  "contact_phone": "+15095550123",
  "relationship": "friend",
  "is_primary": true
}
```

Success response 201:
```json
{
  "contact_id": "UUID"
}
```

Validation:
- contact_name required
- contact_phone required
- relationship required

## 29.9 POST /v1/metrics/daily

Auth: user bearer token

Upsert endpoint by `(user_id, metric_date)`.

Request:
```json
{
  "metric_date": "2026-03-22",
  "steps": 6500,
  "resting_heart_rate_bpm": null,
  "average_heart_rate_bpm": 78.0,
  "hrv_ms": 32.4,
  "sleep_hours": 6.5,
  "sleep_source": "inferred",
  "screen_time_minutes": 280,
  "location_home_ratio": 0.7,
  "location_transitions": 2,
  "noise_level_db_avg": null,
  "mood_score": 2,
  "communication_count": 1
}
```

Success response 200:
```json
{
  "saved": true,
  "assessment_enqueued": true
}
```

## 29.10 GET /v1/risk/current

Auth: user bearer token

Success response 200:
```json
{
  "assessment_time": "2026-03-22T16:00:00Z",
  "risk_score": 0.55,
  "risk_level": "YELLOW",
  "baseline_complete": true,
  "contributing_features": [
    {
      "feature_key": "sleep_hours",
      "current_value": 6.5,
      "baseline_mean": 7.4,
      "baseline_std": 0.6,
      "z_score": -1.5,
      "feature_score": 0.5
    }
  ]
}
```

## 29.11 GET /v1/risk/history?days=30

Auth: user bearer token

Success response 200:
```json
{
  "items": [
    {
      "assessment_time": "2026-03-21T16:00:00Z",
      "risk_score": 0.40,
      "risk_level": "YELLOW"
    }
  ]
}
```

## 29.12 GET /v1/interventions/today

Auth: user bearer token

Success response 200:
```json
{
  "items": [
    {
      "event_id": "UUID",
      "code": "BREATHE_3",
      "name": "3-Minute Breathing Reset",
      "duration_minutes": 3,
      "instructions_markdown": "1. Sit down.\n2. Inhale for 4 seconds.\n3. Exhale for 6 seconds.\n4. Repeat for 3 minutes.",
      "status": "TRIGGERED"
    }
  ]
}
```

## 29.13 POST /v1/interventions/{event_id}/view

Auth: user bearer token

Success response 200:
```json
{
  "saved": true,
  "status": "VIEWED"
}
```

## 29.14 POST /v1/interventions/{event_id}/complete

Auth: user bearer token

Request:
```json
{
  "helpful_rating": 4
}
```

Success response 200:
```json
{
  "saved": true,
  "status": "COMPLETED"
}
```

Validation:
- helpful_rating optional but if present must be 1 to 5 inclusive

## 29.15 POST /v1/interventions/{event_id}/dismiss

Auth: user bearer token

Success response 200:
```json
{
  "saved": true,
  "status": "DISMISSED"
}
```

## 29.16 POST /v1/chat/sessions

Auth: user bearer token

Request:
```json
{}
```

Success response 201:
```json
{
  "session_id": "UUID",
  "state": "CHECK_IN"
}
```

## 29.17 POST /v1/chat/message

Auth: user bearer token

Request:
```json
{
  "session_id": "UUID",
  "message": "I have been feeling off all day."
}
```

Non-crisis response 200:
```json
{
  "reply": "It sounds like today has felt heavy for you. A 3-minute breathing reset may help you slow down a bit. Would you like to try that now?",
  "state": "SUPPORT",
  "crisis_flag": false
}
```

Crisis response 200:
```json
{
  "reply": null,
  "state": "CRISIS",
  "crisis_flag": true
}
```

Validation:
- message required
- session must exist and belong to user
- session must not already be in terminal crisis stop for current interaction

## 29.18 POST /v1/escalations/manual

Auth: user bearer token

Request:
```json
{
  "reason": "I need support"
}
```

Success response 201:
```json
{
  "escalation_id": "UUID",
  "status": "NEW"
}
```

## 29.19 POST /v1/account/export

Auth: user bearer token

Success response 202:
```json
{
  "export_requested": true
}
```

## 29.20 DELETE /v1/account

Auth: user bearer token

Success response 202:
```json
{
  "deletion_requested": true
}
```

## 29.21 Support Dashboard Endpoints

The exact internal API routes may be chosen by implementer, but all must support:

- login
- MFA verify
- queue list
- escalation detail
- assign escalation
- change status
- send template message
- export CSV
- audit log read
- system health read

These endpoints must enforce role-based access control exactly per role definitions.

---

# 30. Standard Error Format

All structured API errors must use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "fields": {
      "field_name": "reason"
    }
  }
}
```

Examples of error codes:
- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

---

# 31. Workflow Definitions

## 31.1 Registration Workflow

1. user enters email, password, age confirm, timezone
2. backend validates
3. backend creates `users` row with `ONBOARDING`
4. email verification token sent
5. user sees verification pending screen

## 31.2 Login Workflow

1. user enters email and password
2. backend validates credentials
3. backend returns temp_session_token
4. user enters MFA code
5. backend returns access and refresh token
6. app loads current onboarding state

## 31.3 Consent Workflow

1. user views legal screens
2. user explicitly toggles required consents
3. submit disabled until all required consents accepted
4. backend writes consent records
5. app proceeds to permission setup

## 31.4 Permission Setup Workflow

1. app explains each permission before OS prompt
2. app requests motion
3. app requests notifications
4. app requests optional permissions one at a time
5. app registers device capabilities with backend
6. app determines ACTIVE vs LIMITED state

## 31.5 Daily Metrics Workflow

1. app aggregates local daily metrics
2. app sends POST /v1/metrics/daily
3. backend upserts daily_metrics
4. backend enqueues worker
5. worker calculates risk
6. worker writes risk_assessments
7. worker decides intervention or escalation
8. app refreshes dashboard on next data fetch

## 31.6 Manual Mood Workflow

1. if no mood entered today, mood card shows CTA
2. user selects value 1 to 5
3. app submits updated daily metrics for today
4. backend re-enqueues assessment

## 31.7 Intervention Workflow

1. intervention event created
2. dashboard card shows suggested action
3. user opens intervention detail
4. backend marks status VIEWED
5. user completes or dismisses
6. backend stores status and optional helpful_rating

## 31.8 Chat Workflow

1. user opens chat screen
2. app creates session if none active
3. user sends message
4. backend runs crisis classifier first
5. if crisis => no normal reply, return CRISIS state
6. else assistant reply generated with structural rules
7. message persistence depends on consent

## 31.9 Crisis Workflow

1. crisis detector triggers
2. chat input disabled
3. crisis screen shown
4. escalation packet created
5. support queue receives item
6. user may call 911, call/text 988, contact trusted person, or message support

## 31.10 Export Workflow

1. user selects export
2. backend queues export job
3. export zip generated
4. signed download link created
5. user receives in-app confirmation

## 31.11 Delete Workflow

1. user selects delete
2. app requires confirmation
3. backend revokes tokens immediately
4. deletion job queued
5. user state transitions to deleted pending internally
6. personal data hard deleted within 24 hours
7. pseudonymized audit records retained

---

# 32. Notification Rules

## 32.1 Lock Screen Sensitivity Rule

Push notifications must never contain:
- crisis
- depression
- anxiety
- self-harm
- suicide
- risk level words

## 32.2 Allowed Notification Titles

Examples:
- `You have a new check-in`
- `A short action is ready`
- `MindLift reminder`

## 32.3 Timing Rules

- default quiet hours = 22:00 to 07:00 local time
- no intervention pushes during quiet hours
- users may customize quiet hours
- maximum 3 intervention notifications per 24-hour period
- maximum 1 missed-mood reminder per day

---

# 33. Privacy and Security Requirements

## 33.1 Transport Security
- TLS 1.3 minimum

## 33.2 At Rest Security
- AES-256 or cloud-provider equivalent managed encryption

## 33.3 Secrets
- secrets stored only in AWS Secrets Manager in deployed environments

## 33.4 Access Control
- role-based access control on all dashboard routes and support APIs

## 33.5 Audit Requirements
Audit all:
- auth events
- consent changes
- support login
- escalation status changes
- support messages
- export requests
- delete requests
- admin actions

## 33.6 Rate Limiting
Apply rate limiting to:
- login
- MFA verify
- chat/message
- password reset

---

# 34. Export Specification

Export archive must be ZIP format and include:

- `profile.json`
- `consents.json`
- `daily_metrics.csv`
- `risk_assessments.csv`
- `intervention_events.csv`
- `chat_messages.csv` only when text logging consent allowed
- `escalations.csv`

Signed URL validity: 15 minutes.

---

# 35. Deletion Specification

Deletion must do all of the following:

- revoke active tokens immediately
- mark user inaccessible for future login
- delete personal data within 24 hours
- remove local app data on next launch if app can still open
- retain audit logs only with actor IDs pseudonymized where appropriate

---

# 36. Support Seed Accounts for Non-Production

Create only in local/dev/staging:

- `admin@mindlift.local`
- `manager@mindlift.local`
- `agent@mindlift.local`
- `auditor@mindlift.local`

Default password:
`ChangeMe123!ChangeMe123!`

All seed support users must be forced to change password on first login.

---

# 37. Testing Requirements

## 37.1 Unit Test Targets

- risk engine: minimum 90% coverage
- crisis classifier wrapper: minimum 90% coverage
- overall backend: minimum 80% coverage

## 37.2 Integration Tests Must Cover

- register -> verify -> login -> MFA
- consent submission
- device registration
- daily metrics upsert
- baseline creation
- missing feature redistribution
- intervention creation
- manual escalation
- crisis chat stop
- export request
- delete request

## 37.3 Mobile Tests Must Cover

- onboarding
- denied permissions
- limited state
- offline queue retry
- crisis screen routing
- chat input disable on crisis

## 37.4 Release Blockers

Do not release if any are true:

- any P0 bug open
- crisis flow fails on any supported platform
- export fails
- delete fails
- login or token refresh fails
- support role permissions fail
- chat continues after crisis trigger

---

# 38. Deployment Requirements

The repository must contain:

1. backend Dockerfile
2. worker Dockerfile
3. dashboard Dockerfile
4. mobile app project
5. docker-compose for local stack
6. Alembic migrations
7. seed script
8. environment template files
9. CI workflows
10. CD workflows

## 38.1 Required Environment Variables

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_SECRETS_MANAGER_PREFIX`
- `OPENAI_API_KEY`
- `EMAIL_SENDER`
- `MFA_ISSUER`
- `APP_BASE_URL`
- `DASHBOARD_BASE_URL`

---

# 39. Build Order

Build in this exact order:

1. authentication and MFA
2. database schema and migrations
3. onboarding and consent UI
4. device registration and permissions
5. daily metrics ingestion
6. baseline and risk worker
7. intervention engine
8. AI chat and crisis stop
9. escalation packet creation
10. support dashboard
11. export and deletion
12. monitoring and release checks

---

# 40. Done Definition

The system is complete only if all are true:

- all required screens exist
- all required endpoints exist
- all workflows work end-to-end
- risk engine runs on daily metrics update
- baseline updates nightly
- interventions trigger correctly
- crisis flow stops normal chat
- escalation appears in support queue
- export works
- delete works
- role-based dashboard permissions work
- mobile builds run on iOS and Android
- staging deploy succeeds from clean repository

---

# 41. Final Instruction to Implementers

Do not infer product behavior that is not defined here.
Do not change exact user-facing safety text.
Do not add diagnostic claims.
Do not allow ordinary chat to continue after crisis trigger.
Where implementation details are not specified, choose the simplest secure approach and document it in the repository README.
