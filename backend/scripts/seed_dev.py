"""
Seed script for non-production environments (local / dev / staging).

Creates the 4 required support accounts from SPEC.md section 36.
Safe to run multiple times (uses ON CONFLICT DO NOTHING).

Usage:
    cd backend
    source .venv/bin/activate
    python scripts/seed_dev.py
"""

import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

# Guard: refuse to run in production
APP_ENV = os.getenv("APP_ENV", "local")
if APP_ENV == "production":
    print("ERROR: seed_dev.py must not run in production.")
    sys.exit(1)

from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://mindlift:mindlift@localhost:5432/mindlift",
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SEED_PASSWORD = "ChangeMe123!ChangeMe123!"

SEED_USERS = [
    {"email": "admin@mindlift.local", "role": "admin"},
    {"email": "manager@mindlift.local", "role": "support_manager"},
    {"email": "agent@mindlift.local", "role": "support_agent"},
    {"email": "auditor@mindlift.local", "role": "read_only_auditor"},
]


async def seed() -> None:
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    password_hash = pwd_context.hash(SEED_PASSWORD)
    now = datetime.now(timezone.utc)

    async with async_session() as session:
        for user in SEED_USERS:
            await session.execute(
                text(
                    """
                    INSERT INTO support_users
                        (id, email, password_hash, role, mfa_enabled, is_active,
                         must_change_password, created_at, updated_at)
                    VALUES
                        (:id, :email, :password_hash, :role, true, true, true,
                         :created_at, :updated_at)
                    ON CONFLICT (email) DO NOTHING
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "email": user["email"],
                    "password_hash": password_hash,
                    "role": user["role"],
                    "created_at": now,
                    "updated_at": now,
                },
            )
            print(f"  seeded: {user['email']} ({user['role']})")

        await session.commit()

    await engine.dispose()
    print(f"\nDone. All seed users must change password on first login.")
    print(f"Default password: {SEED_PASSWORD}")


if __name__ == "__main__":
    print(f"Seeding support users for environment: {APP_ENV}\n")
    asyncio.run(seed())
