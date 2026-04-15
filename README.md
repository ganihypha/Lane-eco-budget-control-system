# Lane-Eco Budget Control System
> Internal Operational Tool — Session / Lane / Ecosystem Budget Management + Prompt Bridge

## Project Overview
- **Build Session**: HUB-17 (Prompt Bridge Implementation)
- **Version**: 1.1.0
- **Status**: ✅ LIVE-VERIFIED (12/12 routes on production)
- **Canonical Repo**: https://github.com/ganihypha/Lane-eco-budget-control-system.git
- **Stack**: Hono + TypeScript + Cloudflare Pages + Tailwind CSS CDN

## URLs
- **Production**: https://lane-eco-budget-control.pages.dev
- **Prompt Bridge**: https://lane-eco-budget-control.pages.dev/bridge
- **GitHub Repo**: https://github.com/ganihypha/Lane-eco-budget-control-system

## What This Is
An internal operational tool that answers:
- What session is active right now?
- Has this session exceeded its budget cap?
- Which lanes are healthy vs overloaded?
- Should the next session GO, WATCH, or STOP?
- How much total ecosystem budget is committed?
- What decisions have been made and why?
- **[NEW] Generate a Master Architect Context Pack from live truth**
- **[NEW] Ingest execution closeout from AI Dev back into the system**

## Architecture Flow (v1.1)
```
Budget Controller App
        ↓
   Prompt Bridge Layer      ← NEW in v1.1
        ↓
 Master Architect Context Pack
        ↓
 Master Architect Prompt
        ↓
   AI Dev / Executor
        ↓
 Execution Closeout         ← Ingested back into app
        ↓
Budget Controller App
```

## Modules
| Module | URL | Purpose |
|---|---|---|
| Dashboard | `/` | Operational overview, active sessions, recommended actions |
| Sessions | `/sessions` | CRUD, budget tracking, blocker management, status control |
| Lanes | `/lanes` | Lane health, session rollup, maintenance decisions |
| Ecosystem | `/ecosystem` | Period budget cap, pressure monitoring, freeze rules |
| Decision Log | `/decisions` | Why things continued, stopped, froze, or escalated |
| **Prompt Bridge** | `/bridge` | **Generate Master Architect Context Pack + Ingest Closeout** |

## Prompt Bridge (v1.1) — API Endpoints
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/bridge` | Prompt Bridge UI (pack generator + closeout ingestor) |
| GET | `/bridge/api/pack?session=ID` | **Generate full Master Architect Context Pack** |
| GET | `/bridge/api/ecosystem` | Ecosystem pressure + freeze state |
| GET | `/bridge/api/repo` | Repo / deploy authority truth |
| GET | `/bridge/api/session?id=ID` | Session context export |
| GET | `/bridge/api/lane?id=ID` | Lane context export |
| GET | `/bridge/api/decisions?type=T&id=ID` | Decision summary |
| POST | `/bridge/api/ingest` | Ingest execution closeout (JSON body) |

### Ingest Closeout Payload
```json
{
  "session_id": "HUB-17",
  "final_status": "done",
  "actual_output": "What was delivered",
  "actual_budget_unit": 5,
  "blocker_type": "none",
  "decision_type": "go",
  "decision_reason": "Why this decision was made",
  "next_locked_move": "What comes next",
  "evidence_links": ["https://..."],
  "created_by": "Founder"
}
```

## Core Domain Model
### Session
Single execution unit. Tracks: planned_budget, hard_cap, actual_burn, status, blocker_type, go/stop signal.

### Lane
Collection of sessions under one operational stream. Tracks: budget rollup, health (healthy/watch/overloaded/frozen), session count.

### Ecosystem
Top-level control context. Tracks: total budget cap, active lane/session limits, ecosystem health, freeze rules.

### Decision Log
Historical record of every control decision (go/stop/freeze/escalate/defer/close) with reason and evidence.

### Prompt Bridge
Export layer that converts structured operational truth into Master Architect Context Pack.
- Phase A: Export Layer (session, lane, ecosystem context)
- Phase B: Pack Generator (generateMasterArchitectPack)
- Phase C: Closeout Ingestor (ingestExecutionCloseout)

## Budget Logic
- **Planned Budget**: Expected spend
- **Hard Cap**: Absolute stop limit — never exceed
- **Actual Burn**: Manually logged per session
- **Variance**: Planned - Actual
- **Cap Status**: safe (< 80%) / warning (80-99%) / exceeded (≥ 100%)
- **GO/WATCH/STOP Signal**: Computed from cap status + blocker + session status
- **Lane Rollup**: Sum of all session actual_burn in the lane
- **Ecosystem Rollup**: Sum of all non-cancelled sessions

## Development
```bash
npm install
npm run build
pm2 start ecosystem.config.cjs
# → http://localhost:3000
```

## Deployment (Cloudflare Pages)
```bash
# Requires: CLOUDFLARE_API_TOKEN
npm run build
npx wrangler pages deploy dist --project-name lane-eco-budget-control
```

## Current Status
- ✅ All 6 modules operational (Dashboard, Sessions, Lanes, Ecosystem, Decisions, Prompt Bridge)
- ✅ Prompt Bridge: Phase A (Export), Phase B (Pack Generator), Phase C (Closeout Ingestor)
- ✅ 7 Bridge API endpoints live
- ✅ Full CRUD: Sessions, Lanes, Ecosystem config
- ✅ Budget rollup: Session → Lane → Ecosystem
- ✅ Over-cap detection + STOP signal
- ✅ Lane health computation (healthy/watch/overloaded/frozen)
- ✅ Ecosystem health computation
- ✅ Recommended actions engine
- ✅ Decision log with entity linking
- ✅ LIVE on Cloudflare Pages — 12/12 routes verified (v1.1)
- ✅ GitHub pushed → ganihypha/Lane-eco-budget-control-system (main, HUB-17)
- ⏳ Persistence: In-memory (upgrade to Cloudflare D1 when needed)

## Next Locked Move (Post-HUB-17)
1. **Use Prompt Bridge** → go to `/bridge`, select session, generate pack, paste into Master Architect Prompt
2. Optional: Add D1 persistence for data survival across restarts
3. Optional: BarberKas lane becomes first real use case

## Repo Reality
- **Canonical Product Repo**: https://github.com/ganihypha/Lane-eco-budget-control-system.git
- **Canonical Ecosystem Repo**: https://github.com/ganihypha/Sovereign-ecosystem (governance home)
- **Live URL**: https://lane-eco-budget-control.pages.dev/
- **Execution Status**: LIVE-VERIFIED ✅
