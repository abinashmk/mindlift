# MindLift

A clinical-adjacent mental-health early-intervention support system.

MindLift collects user-consented behavioral and physiological data, learns an individual baseline, detects deviations, computes a risk level, and offers brief non-clinical interventions with bounded AI-assisted supportive chat.

> **Disclaimer:** MindLift is a self-management and support tool. It does not diagnose medical or mental-health conditions and does not replace a licensed clinician or emergency services.

---

## Project Structure

```
mindlift/
├── mobile/        # React Native app (iOS + Android)
├── backend/       # Python FastAPI backend
├── dashboard/     # React web support dashboard
├── SPEC.md        # Full engineering execution specification
└── README.md
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native, TypeScript, Redux Toolkit |
| Backend | Python 3.11, FastAPI, SQLAlchemy, Alembic |
| Async | Celery, Redis 7 |
| Database | PostgreSQL 15 |
| Dashboard | React, TypeScript |
| Infrastructure | Docker, AWS (EC2, RDS, ElastiCache, S3) |

## Getting Started

See [SPEC.md](./SPEC.md) for the full implementation specification.

### Prerequisites
- Node.js 18+
- Python 3.11+
- Docker + docker-compose
- React Native dev environment (Xcode / Android Studio)

### Local Development

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
docker-compose up -d  # starts PostgreSQL + Redis

# Dashboard
cd dashboard
npm install
npm run dev

# Mobile
cd mobile
npm install
npx react-native start
```

## Environments

| Environment | API | Dashboard |
|-------------|-----|-----------|
| dev | api-dev.mindlift.app | — |
| staging | api-staging.mindlift.app | dashboard-staging.mindlift.app |
| production | api.mindlift.app | dashboard.mindlift.app |

## Implementation Notes

Any behavior not explicitly described in SPEC.md has been implemented using the simplest approach that does not conflict with any rule in the spec. Such decisions are documented here as they are made during development.

---

**US-only. Adults 18+ only.**
