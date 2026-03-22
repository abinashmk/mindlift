"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-03-22 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------ users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.Text, nullable=False),
        sa.Column("email_verified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("age_confirmed_18_plus", sa.Boolean, nullable=False),
        sa.Column("first_name", sa.String(100), nullable=True),
        sa.Column("timezone", sa.String(100), nullable=False),
        sa.Column("state", sa.String(20), nullable=False, server_default="ONBOARDING"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("idx_users_email", "users", ["email"])

    # ----------------------------------------------------------- user_consents
    op.create_table(
        "user_consents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("consent_key", sa.String(100), nullable=False),
        sa.Column("consent_value", sa.Boolean, nullable=False),
        sa.Column("policy_version", sa.String(50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("idx_user_consents_user_id", "user_consents", ["user_id"])
    op.create_index("idx_user_consents_key", "user_consents", ["consent_key"])

    # --------------------------------------------------------------- devices
    op.create_table(
        "devices",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("os_version", sa.String(50), nullable=False),
        sa.Column("app_version", sa.String(50), nullable=False),
        sa.Column("push_token", sa.Text, nullable=True),
        sa.Column("notifications_enabled", sa.Boolean, nullable=False),
        sa.Column("motion_permission", sa.Boolean, nullable=False),
        sa.Column("health_permission", sa.Boolean, nullable=False),
        sa.Column("location_permission", sa.Boolean, nullable=False),
        sa.Column("noise_permission", sa.Boolean, nullable=False),
        sa.Column("biometric_enabled", sa.Boolean, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("idx_devices_user_id", "devices", ["user_id"])

    # ---------------------------------------------------------- daily_metrics
    op.create_table(
        "daily_metrics",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("metric_date", sa.Date, nullable=False),
        sa.Column("steps", sa.Integer, nullable=True),
        sa.Column("resting_heart_rate_bpm", sa.Double(precision=53), nullable=True),
        sa.Column("average_heart_rate_bpm", sa.Double(precision=53), nullable=True),
        sa.Column("hrv_ms", sa.Double(precision=53), nullable=True),
        sa.Column("sleep_hours", sa.Double(precision=53), nullable=True),
        sa.Column("sleep_source", sa.String(20), nullable=True),
        sa.Column("screen_time_minutes", sa.Integer, nullable=True),
        sa.Column("location_home_ratio", sa.Double(precision=53), nullable=True),
        sa.Column("location_transitions", sa.Integer, nullable=True),
        sa.Column("noise_level_db_avg", sa.Double(precision=53), nullable=True),
        sa.Column("mood_score", sa.Integer, nullable=True),
        sa.Column("communication_count", sa.Integer, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "metric_date", name="uq_daily_metrics_user_date"),
    )
    op.create_index("idx_daily_metrics_user_date", "daily_metrics", ["user_id", "metric_date"])

    # --------------------------------------------------------------- baselines
    op.create_table(
        "baselines",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("feature_key", sa.String(100), nullable=False),
        sa.Column("mean_value", sa.Double(precision=53), nullable=False),
        sa.Column("std_value", sa.Double(precision=53), nullable=False),
        sa.Column("valid_days", sa.Integer, nullable=False),
        sa.Column("baseline_start_date", sa.Date, nullable=False),
        sa.Column("baseline_end_date", sa.Date, nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "feature_key", name="uq_baselines_user_feature"),
    )

    # ------------------------------------------------------- risk_assessments
    op.create_table(
        "risk_assessments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assessment_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("assessment_scope", sa.String(20), nullable=False),
        sa.Column("risk_score", sa.Double(precision=53), nullable=False),
        sa.Column("risk_level", sa.String(20), nullable=False),
        sa.Column("feature_sleep_score", sa.Double(precision=53), nullable=True),
        sa.Column("feature_activity_score", sa.Double(precision=53), nullable=True),
        sa.Column("feature_heart_score", sa.Double(precision=53), nullable=True),
        sa.Column("feature_social_score", sa.Double(precision=53), nullable=True),
        sa.Column(
            "contributing_features", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("model_version", sa.String(50), nullable=False),
        sa.Column("baseline_complete", sa.Boolean, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "idx_risk_assessments_user_time", "risk_assessments", ["user_id", "assessment_time"]
    )

    # ---------------------------------------------------------- interventions
    op.create_table(
        "interventions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("duration_minutes", sa.Integer, nullable=False),
        sa.Column("instructions_markdown", sa.Text, nullable=False),
        sa.Column(
            "contraindications", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index("idx_interventions_code", "interventions", ["code"])

    # ------------------------------------------------------ intervention_events
    op.create_table(
        "intervention_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("intervention_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("risk_level", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="TRIGGERED"),
        sa.Column("completed", sa.Boolean, nullable=True),
        sa.Column("helpful_rating", sa.Integer, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["intervention_id"], ["interventions.id"]),
    )

    # ---------------------------------------------------------- chat_sessions
    op.create_table(
        "chat_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("state", sa.String(20), nullable=False, server_default="IDLE"),
        sa.Column("crisis_flag", sa.Boolean, nullable=False, server_default="false"),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )

    # ---------------------------------------------------------- chat_messages
    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sender_type", sa.String(20), nullable=False),
        sa.Column("message_text", sa.Text, nullable=True),
        sa.Column("message_length", sa.Integer, nullable=True),
        sa.Column(
            "classifier_result", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["session_id"], ["chat_sessions.id"], ondelete="CASCADE"),
    )

    # -------------------------------------------------- escalation_contacts
    op.create_table(
        "escalation_contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("contact_name", sa.String(200), nullable=False),
        sa.Column("contact_phone", sa.String(50), nullable=False),
        sa.Column("relationship", sa.String(100), nullable=False),
        sa.Column("is_primary", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )

    # ----------------------------------------------------------- escalations
    op.create_table(
        "escalations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="NEW"),
        sa.Column("risk_level", sa.String(20), nullable=False),
        sa.Column("packet", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("assigned_agent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("idx_escalations_status", "escalations", ["status"])
    op.create_index("idx_escalations_created_at", "escalations", ["created_at"])

    # --------------------------------------------------------- support_users
    op.create_table(
        "support_users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.Text, nullable=False),
        sa.Column("role", sa.String(30), nullable=False),
        sa.Column("mfa_enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("must_change_password", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("idx_support_users_email", "support_users", ["email"])

    # ------------------------------------------------------------ audit_logs
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_type", sa.String(30), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action_key", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(100), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_audit_logs_created_at", "audit_logs", ["created_at"])

    # ------------------------------------ Seed intervention data
    op.execute(
        """
        INSERT INTO interventions (id, code, name, type, duration_minutes, instructions_markdown, contraindications, active, created_at, updated_at)
        VALUES
        (
            gen_random_uuid(),
            'WALK_5',
            '5-Minute Walk',
            'walk',
            5,
            '1. Stand up slowly.\n2. Walk at a comfortable pace for 5 minutes.\n3. Breathe normally.\n4. When done, return and rate whether it helped.',
            '["mobility_issue","user_marked_not_safe_to_walk"]',
            true,
            now(),
            now()
        ),
        (
            gen_random_uuid(),
            'BREATHE_3',
            '3-Minute Breathing Reset',
            'breathing',
            3,
            '1. Sit down.\n2. Inhale for 4 seconds.\n3. Exhale for 6 seconds.\n4. Repeat for 3 minutes.',
            '["none"]',
            true,
            now(),
            now()
        ),
        (
            gen_random_uuid(),
            'SLEEP_CHECK',
            'Sleep Setup Reminder',
            'sleep_hygiene',
            2,
            '1. Dim lights.\n2. Put the phone away.\n3. Reduce noise.\n4. Start your bedtime routine now.',
            '["none"]',
            true,
            now(),
            now()
        ),
        (
            gen_random_uuid(),
            'GROUND_54321',
            '5-4-3-2-1 Grounding',
            'grounding',
            4,
            '1. Name 5 things you see.\n2. Name 4 things you can touch.\n3. Name 3 things you hear.\n4. Name 2 things you smell.\n5. Name 1 thing you taste.',
            '["none"]',
            true,
            now(),
            now()
        ),
        (
            gen_random_uuid(),
            'SOCIAL_TEXT',
            'Send One Friendly Message',
            'social_nudge',
            3,
            '1. Choose one person you trust.\n2. Send a short friendly message.\n3. Do not wait for a perfect message.\n4. Mark complete after sending.',
            '["user_opted_out_social"]',
            true,
            now(),
            now()
        )
        ON CONFLICT (code) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("support_users")
    op.drop_table("escalations")
    op.drop_table("escalation_contacts")
    op.drop_table("chat_messages")
    op.drop_table("chat_sessions")
    op.drop_table("intervention_events")
    op.drop_table("interventions")
    op.drop_table("risk_assessments")
    op.drop_table("baselines")
    op.drop_table("daily_metrics")
    op.drop_table("devices")
    op.drop_table("user_consents")
    op.drop_table("users")
