# MindLift — Claude Code Instructions

## Specification
The full engineering spec is in @SPEC.md. All product behavior must match the spec exactly.
If a behavior is not in the spec, choose the simplest implementation that doesn't conflict with any rule, and document the choice in README.md under "Implementation Notes".

## Project Structure
- `mobile/` — React Native app (iOS + Android)
- `backend/` — Python FastAPI backend
- `dashboard/` — React web support dashboard

## Tech Stack
- Mobile: React Native, TypeScript, Redux Toolkit, React Navigation, encrypted SQLite
- Backend: Python 3.11, FastAPI, Pydantic, SQLAlchemy, Alembic, Celery, Redis 7
- Database: PostgreSQL 15
- Dashboard: React, TypeScript
- Infrastructure: Docker, docker-compose (local), AWS (deployed)

## Critical Safety Rules
1. Never implement any feature that could be interpreted as diagnosis, treatment, or clinical advice
2. Crisis detection must always result in hard stop of AI chat and display of exact crisis message from spec
3. Never store raw audio, exact GPS coordinates, or SMS/call content
4. Age gate: block registration for users under 18 — no partial account in active users table
5. All AI chat must display the exact disclosure text from spec (section 4.1)

## Code Standards
- TypeScript strict mode for mobile and dashboard
- Python type hints throughout backend
- All API endpoints must have Pydantic request/response models
- Write tests alongside implementation (pytest for backend, Jest for mobile/dashboard)
- Use Alembic for all database migrations — never alter tables manually

## Build & Test Commands
### Backend
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload          # dev server
pytest                                  # run tests
alembic upgrade head                    # run migrations
celery -A app.worker worker --loglevel=info  # start worker
```

### Dashboard
```bash
cd dashboard
npm run dev      # dev server
npm test         # run tests
npm run build    # production build
```

### Mobile
```bash
cd mobile
npx react-native start           # Metro bundler
npx react-native run-ios         # iOS
npx react-native run-android     # Android
npm test                         # Jest
```

## Environments
- local: docker-compose
- dev: api-dev.mindlift.app
- staging: api-staging.mindlift.app / dashboard-staging.mindlift.app
- production: api.mindlift.app / dashboard.mindlift.app

## Roles
- `end_user` — mobile app user
- `support_agent` — dashboard user, handles escalations
- `support_manager` — manages agents, views all escalations
- `admin` — full system access
- `read_only_auditor` — read-only dashboard access

## What NOT to build
- Diagnostic questionnaires that produce diagnoses
- Telehealth video
- Peer community / social features
- Bluetooth wearable integrations (beyond OS health frameworks)
- Internationalization / multilingual UI
- Family accounts or minor users
- Insurance billing
