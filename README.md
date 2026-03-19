# 🛡️ Cyber-Rans — Cybersecurity IR Training Platform

A self-hosted, multi-player incident response training platform. Analysts step through realistic ransomware scenarios as first-person simulations, making decisions at each NIST SP 800-61r2 phase. Built for red/blue team exercises, SOC onboarding, and security awareness programmes.

---

## Features

- **15 ransomware IR simulation scenarios** — 2 easy / 5 medium / 8 hard
- **First-person analyst simulations** — no historical company names, dates, or ransom amounts; pure hands-on IR decisions
- **NIST SP 800-61r2 phases** — Preparation → Detection & Analysis → Containment, Eradication & Recovery → Post-Incident Activity
- **MITRE ATT&CK mapped** — every scenario includes TTP IDs and technical explanations
- **Multi-player sessions** — share a link; multiple analysts join the same live session via WebSocket
- **Real-time activity log** — all decisions logged with timestamps and IR phase labels
- **Debrief report** — lessons learned, reference links, and jsPDF export
- **Admin CRUD panel** — create, edit, and delete scenarios via the UI
- **JWT auth** — short-lived access tokens + Redis-backed opaque refresh tokens
- **Fully containerised** — single `docker compose up --build` to run everything

---

## Architecture

```
┌─────────────┐     REST/WS      ┌──────────────────┐     SQL      ┌──────────────┐
│   React UI  │ ◄──────────────► │  FastAPI Backend  │ ◄──────────► │  PostgreSQL  │
│  (Vite/TS)  │                  │  (Python 3.12)    │              │  (port 5432) │
└─────────────┘                  └──────┬────────────┘              └──────────────┘
     :5173                              │ Redis pub/sub                     
                                        ▼                            ┌──────────────┐
                               ┌────────────────┐    state sync      │    Redis     │
                               │  Orchestrator  │ ◄────────────────► │  (port 6379) │
                               │  (docker-py)   │                    └──────────────┘
                               └───────┬────────┘
                                       │ spawn/stop
                                       ▼
                               ┌────────────────────────┐
                               │  Scenario Worker (N)   │
                               │  Isolated container    │
                               │  per game session      │
                               │  WS :8765/ws/game      │
                               └────────────────────────┘
```

### Services

| Service | Port | Description |
|---|---|---|
| `frontend` | 5173 | React + Vite + Tailwind CSS player UI |
| `backend` | 8000 | FastAPI — auth, scenario CRUD, game REST + WebSocket |
| `orchestrator` | 9000 | Manages scenario-worker container lifecycle via docker-py |
| `db` | 5432 | PostgreSQL 16 — users, scenarios, game sessions |
| `redis` | 6379 | Refresh tokens, live game state, worker registry |
| `scenario-worker` | 8765 | Per-session isolated FastAPI WebSocket container |

### Data flow (game session)

1. Player selects a scenario → `POST /api/v1/game/start/:id` → creates session in DB + Redis
2. Frontend opens WebSocket → `WS /api/v1/game/play/:session_id`
3. Backend WS handler proxies decisions through game logic, persists state to Redis
4. State sync broadcast to all connected clients in the same session
5. On game end → summary + lessons learned served; jsPDF debrief exported client-side

---

## Quick Start

### Prerequisites

- Docker + Docker Compose v2
- 4 GB RAM minimum
- Ports 5173, 8000, 9000, 5432, 6379 available

### 1 — Clone and start

```bash
git clone https://github.com/yourorg/cyber-rans.git
cd cyber-rans
docker compose up --build
```

> First build takes 3–5 minutes (Python deps + npm install). Subsequent starts are fast.

### 2 — Run database migrations

```bash
docker exec -it cyberrans_backend alembic upgrade head
```

### 3 — Seed scenarios

```bash
docker exec -it cyberrans_backend python scripts/seed_scenarios.py
```

### 4 — Open the app

| URL | Purpose |
|---|---|
| http://localhost:5173 | Player interface |
| http://localhost:5173 → ⚙ Admin | Admin scenario management |
| http://localhost:8000/docs | FastAPI Swagger UI |
| http://localhost:9000/docs | Orchestrator Swagger UI |

### 5 — Create an admin account

Use the Swagger UI at http://localhost:8000/docs:

```
POST /api/v1/auth/register
{
  "username": "admin",
  "email": "admin@example.com",
  "password": "your-password"
}
```

Then manually set `is_admin = true` in the database:

```bash
docker exec -it cyberrans_db psql -U cyber -d cyberrans \
  -c "UPDATE users SET is_admin = true WHERE username = 'admin';"
```

---

## Configuration

All backend configuration is in `backend/.env`:

```env
# PostgreSQL
DATABASE_URL=postgresql+asyncpg://cyber:cyber@db:5432/cyberrans
SYNC_DATABASE_URL=postgresql+psycopg2://cyber:cyber@db:5432/cyberrans

# Redis
REDIS_URL=redis://redis:6379/0

# JWT — generate a strong secret:
# python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=CHANGE_ME_IN_PRODUCTION
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# App
APP_ENV=development
APP_BASE_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
```

> **Production note:** Always replace `SECRET_KEY` with a cryptographically random 32-byte hex string before deploying.

---

## Scenario Schema

Each scenario uses the following JSON structure for `scenario_structure`:

```json
{
  "ransomwareFamily": "CryptoLocker-class (phishing-delivered, RSA+AES)",
  "irPhase": "Detection & Analysis",
  "attackVector": "Phishing email with malicious .docm attachment...",
  "keyTTPs": [
    "T1566.001 — Phishing: Spearphishing Attachment",
    "T1486 — Data Encrypted for Impact"
  ],
  "simulationContext": "Mid-sized financial services firm, ~400 employees...",
  "decisionTree": [
    {
      "stageId": "phase2_initial_triage",
      "irPhase": "Detection & Analysis",
      "prompt": "The user is still on the phone...",
      "analystContext": "Available tools: SIEM, RMM agent...",
      "options": [
        {
          "actionText": "Isolate the workstation via the RMM agent",
          "isCorrect": true,
          "consequence": "Network isolation stops C2 and prevents SMB spread.",
          "nextStageId": "phase2_artifact_collection",
          "technicalExplanation": "CryptoLocker-class ransomware must contact C2..."
        }
      ]
    }
  ],
  "lessonsLearned": [
    "Network isolation via RMM must be the first action",
    "RAM acquisition before remediation can preserve encryption keys"
  ],
  "referenceLinks": [
    "https://www.cisa.gov/stopransomware/ransomware-guide",
    "https://www.nist.gov/publications/computer-security-incident-handling-guide"
  ]
}
```

### Content rules for scenarios

- ✗ No specific years in narrative text (prompts, analyst context, consequences)
- ✗ No real company or victim names in simulation text
- ✗ No specific ransom dollar amounts in decision prompts
- ✓ First-person analyst perspective throughout
- ✓ NIST SP 800-61r2 IR phase labelled on every stage
- ✓ MITRE ATT&CK technique IDs in `keyTTPs`
- ✓ Technical explanations grounded in real TTP mechanics

---

## Included Scenarios

| # | Name | Class | Difficulty |
|---|---|---|---|
| 1 | Operation: Encrypted Inbox | CryptoLocker-class (phishing .docm) | Easy |
| 2 | Operation: Cracked Software | GandCrab/REvil-class (pirated software) | Easy |
| 3 | Operation: Ghost Credential | DarkSide-class (stale VPN + no MFA) | Medium |
| 4 | Operation: Impersonation Call | Scattered Spider-class (vishing helpdesk) | Medium |
| 5 | Operation: Silent Exfiltration | Clop-class (SQL injection zero-day, data theft) | Medium |
| 6 | Operation: Ready State | IR readiness (Preparation phase) | Medium |
| 7 | Operation: MSP Cascade | REvil-class (RMM supply chain) | Medium |
| 8 | Operation: SMB Storm | WannaCry-class (EternalBlue worm) | Hard |
| 9 | Operation: Silent Loader | Ryuk/Conti-class (BazarLoader → CS → manual) | Hard |
| 10 | Operation: Hypervisor Lockout | ALPHV/BlackCat-class (ESXi encryption) | Hard |
| 11 | Operation: Poisoned Update | NotPetya-class (supply chain wiper) | Hard |
| 12 | Operation: RDP Breach | LockBit-class (RDP brute force + GPO spread) | Hard |
| 13 | Operation: Exchange Breach | Conti-class (ProxyShell + double extortion) | Hard |
| 14 | Operation: Zero Privilege | Conti-class (MS-NRPC auth bypass) | Hard |
| 15 | Operation: Threat Hunt | Cobalt Strike detection (proactive hunting) | Medium |

---

## API Reference

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Login, receive token pair |
| POST | `/api/v1/auth/refresh` | Rotate refresh token |
| POST | `/api/v1/auth/logout` | Revoke refresh token |
| GET | `/api/v1/auth/me` | Current user profile |

### Scenarios (admin write, authenticated read)

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/scenarios` | List all (summary) |
| GET | `/api/v1/scenarios/:id` | Full scenario with structure |
| POST | `/api/v1/scenarios` | Create (admin only) |
| PUT | `/api/v1/scenarios/:id` | Full update (admin only) |
| PATCH | `/api/v1/scenarios/:id` | Partial update (admin only) |
| DELETE | `/api/v1/scenarios/:id` | Delete (admin only) |

### Game

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/game/scenarios` | Public scenario list |
| GET | `/api/v1/game/scenarios/:id` | Public full scenario |
| POST | `/api/v1/game/start/:scenario_id` | Create session |
| GET | `/api/v1/game/join/:session_id` | Session info |
| POST | `/api/v1/game/join/:session_id` | Register as participant |
| WS | `/api/v1/game/play/:session_id` | WebSocket game loop |

### WebSocket message types

```
Client → Server:
  { "type": "begin" }
  { "type": "make_choice", "stage_id": "...", "option_index": 0 }
  { "type": "request_state" }
  { "type": "save_exit" }
  { "type": "ping" }

Server → Client:
  { "type": "connected", "state": {...}, "scenario": {...} }
  { "type": "state_sync", "state": {...} }
  { "type": "choice_result", "is_correct": true, "consequence": "...", ... }
  { "type": "game_end", "summary": {...}, "state": {...} }
  { "type": "presence_update", "online_client_ids": [...] }
  { "type": "member_joined", "name": "...", "client_id": "..." }
  { "type": "member_left", "name": "...", "client_id": "..." }
  { "type": "error", "message": "..." }
  { "type": "pong" }
```

---

## Development

### Backend

```bash
cd backend
pip install -r requirements.txt
# With local DB/Redis running:
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Running tests (example)

```bash
docker exec -it cyberrans_backend pytest tests/ -v
```

### Alembic migrations

```bash
# Create a new migration
docker exec -it cyberrans_backend alembic revision --autogenerate -m "add field"

# Apply migrations
docker exec -it cyberrans_backend alembic upgrade head

# Rollback one step
docker exec -it cyberrans_backend alembic downgrade -1
```

---

## Project Structure

```
cyber-rans/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── script.py.mako
│   ├── app/
│   │   ├── config.py          # pydantic-settings
│   │   ├── database.py        # async SQLAlchemy + Redis
│   │   ├── main.py            # FastAPI app factory
│   │   ├── auth/
│   │   │   ├── jwt.py         # access + refresh token logic
│   │   │   └── dependencies.py
│   │   ├── models/models.py   # User, Scenario, GameSession
│   │   ├── schemas/schemas.py # Pydantic v2 schemas
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── scenarios.py
│   │   │   └── game.py        # REST + WebSocket game loop
│   │   └── game/
│   │       ├── logic.py       # pure-function game rules
│   │       ├── redis_state.py # session state helpers
│   │       └── connection_manager.py
│   └── scripts/
│       └── seed_scenarios.py
├── orchestrator/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── config.py
│       ├── docker_manager.py  # docker-py container lifecycle
│       ├── worker_registry.py # Redis worker registry
│       └── main.py
├── scenario-worker/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── config.py
│       ├── logic.py           # game logic (self-contained copy)
│       ├── redis_state.py
│       └── main.py            # isolated WS game loop
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx            # state-based router
        ├── api/               # REST + WS client wrappers
        ├── components/        # ActivityLog, AttemptsMeter, etc.
        ├── hooks/             # useWebSocketGame, useReportPdf
        ├── pages/             # Selector, Player, Join, Debrief, Admin
        └── types/scenario.ts  # shared TypeScript types
```

---

## Security Notes

- Change `SECRET_KEY` in `backend/.env` before any non-local deployment
- The Docker socket mount (`/var/run/docker.sock`) on the orchestrator grants container-level access — restrict network access to the orchestrator service in production
- Admin account requires a database-level privilege escalation (`UPDATE users SET is_admin = true`) — no self-registration to admin role is possible through the API
- Refresh tokens are opaque UUIDs stored in Redis with a configurable TTL (default 7 days)
- CORS is configured via `ALLOWED_ORIGINS` in `.env`

---

## License

This project is licensed under the **GNU General Public License v3.0**.  
See `LICENSE` for the full text.
