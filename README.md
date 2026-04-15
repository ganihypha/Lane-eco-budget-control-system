# Lane-Eco Budget Control System
> Internal Operational Tool — Session / Lane / Ecosystem Budget Management

## Project Overview
- **Build Session**: HUB-16 (Greenfield Build)
- **Version**: 1.0.0
- **Status**: ✅ BUILD-VERIFIED (local)
- **Canonical Repo**: https://github.com/ganihypha/Lane-eco-budget-control-system.git
- **Stack**: Hono + TypeScript + Cloudflare Pages + Tailwind CSS CDN

## What This Is
An internal operational tool that answers:
- What session is active right now?
- Has this session exceeded its budget cap?
- Which lanes are healthy vs overloaded?
- Should the next session GO, WATCH, or STOP?
- How much total ecosystem budget is committed?
- What decisions have been made and why?

## Modules
| Module | URL | Purpose |
|---|---|---|
| Dashboard | `/` | Operational overview, active sessions, recommended actions |
| Sessions | `/sessions` | CRUD, budget tracking, blocker management, status control |
| Lanes | `/lanes` | Lane health, session rollup, maintenance decisions |
| Ecosystem | `/ecosystem` | Period budget cap, pressure monitoring, freeze rules |
| Decision Log | `/decisions` | Why things continued, stopped, froze, or escalated |

## Core Domain Model
### Session
Single execution unit. Tracks: planned_budget, hard_cap, actual_burn, status, blocker_type, go/stop signal.

### Lane
Collection of sessions under one operational stream. Tracks: budget rollup, health (healthy/watch/overloaded/frozen), session count.

### Ecosystem
Top-level control context. Tracks: total budget cap, active lane/session limits, ecosystem health, freeze rules.

### Decision Log
Historical record of every control decision (go/stop/freeze/escalate/defer/close) with reason and evidence.

## Budget Logic
- **Planned Budget**: Expected spend
- **Hard Cap**: Absolute stop limit — never exceed
- **Actual Burn**: Manually logged per session
- **Variance**: Planned - Actual
- **Cap Status**: safe (< 80%) / warning (80-99%) / exceeded (≥ 100%)
- **GO/WATCH/STOP Signal**: Computed from cap status + blocker + session status
- **Lane Rollup**: Sum of all session actual_burn in the lane
- **Ecosystem Rollup**: Sum of all non-cancelled sessions

## Intensity Scale
| Level | Label |
|---|---|
| 1 | Light |
| 2 | Medium |
| 3 | Heavy |
| 4 | Very Heavy |
| 5 | Premium / Extreme |

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
npx wrangler pages project create lane-eco-budget-control-system --production-branch main
npx wrangler pages deploy dist --project-name lane-eco-budget-control-system
```

## Current Status
- ✅ All 5 modules operational (Dashboard, Sessions, Lanes, Ecosystem, Decisions)
- ✅ Full CRUD: Sessions, Lanes, Ecosystem config
- ✅ Budget rollup: Session → Lane → Ecosystem
- ✅ Over-cap detection + STOP signal
- ✅ Lane health computation (healthy/watch/overloaded/frozen)
- ✅ Ecosystem health computation
- ✅ Recommended actions engine
- ✅ Decision log with entity linking
- ✅ Quick status actions (mark done/blocked/frozen/cancelled)
- ✅ BUILD-VERIFIED (local, 12/12 routes pass)
- ⏳ Persistence: In-memory (upgrade to Cloudflare D1 when needed)
- ⏳ GitHub push: Pending auth setup
- ⏳ Cloudflare deploy: Pending API token

## Next Locked Move (Post-HUB-16)
1. Setup GitHub auth → push to `ganihypha/Lane-eco-budget-control-system`
2. Setup Cloudflare API token → deploy to Cloudflare Pages
3. Optional: Add D1 persistence for data survival across restarts
4. Optional: BarberKas lane becomes first real use case
