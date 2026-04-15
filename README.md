# Lane-Eco Budget Control System

**Version:** 1.2.0 | **Build Session:** HUB-18 | **Status:** ✅ LIVE-VERIFIED

Internal operational tool for managing session, lane, and ecosystem budgets — with Sovereign Source Intake for canonical truth grounding.

---

## Live URLs
- **Production:** https://lane-eco-budget-control.pages.dev
- **Prompt Bridge:** https://lane-eco-budget-control.pages.dev/bridge
- **Sovereign Intake:** https://lane-eco-budget-control.pages.dev/sovereign
- **GitHub Repo:** https://github.com/ganihypha/Lane-eco-budget-control-system

---

## Modules (7 total — all LIVE-VERIFIED)

| Module | Route | Description |
|---|---|---|
| Dashboard | `/` | Budget overview, signals, recommended actions |
| Sessions | `/sessions` | CRUD + budget tracking per session |
| Lanes | `/lanes` | Lane health + budget rollup |
| Ecosystem | `/ecosystem` | Total cap, freeze rules, pressure level |
| Decision Log | `/decisions` | Historical go/stop/freeze decisions |
| Prompt Bridge | `/bridge` | Generate Master Architect Context Pack |
| Sovereign Intake | `/sovereign` | Ingest canonical current-handoff truth |

---

## Architecture

```
Sovereign Source (P1 current-handoff)
         ↓
Budget Controller App (P3 — operational truth surface)
         ↓
Prompt Bridge (context export + pack generator)
         ↓
Master Architect Context Pack (17 sections, sovereign-grounded)
         ↓
Master Architect Prompt → AI Dev Executor
         ↓
Closeout Ingest → Back to App
```

### Truth Precedence (P1 > P2 > P3 > P4 > P5)
| Level | Source | Description |
|---|---|---|
| P1 | current-handoff | Canonical operating truth (highest) |
| P2 | active-priority | Future priority doc |
| P3 | live controller | Budget Controller app state |
| P4 | repo/deploy | GitHub + Cloudflare runtime |
| P5 | notes | Conversational context (lowest) |

---

## Sovereign Source Intake (HUB-18)

**Purpose:** Ground the Prompt Bridge in real canonical truth from `current-handoff` documents instead of relying on controller state alone.

### Layers
- **Layer A — Ingestion:** `ingestSovereignSource(docId, docType, rawMarkdown)`
- **Layer B — Normalization:** Extract session, module, governance, repo, secret, next-move truth from markdown
- **Layer C — Bridge Store Sync:** `syncSovereignIntakeToBridgeStore()` — persists without overwriting controller
- **Layer D — Pack Merge:** `mergeSovereignTruthWithControllerState()` — applies P1-P5 precedence

### Status Normalization Enums
`verified_ready_to_close` | `build_verified` | `live_verified` | `route_verified` | `closed_verified` | `complete_synced` | `partial` | `blocked` | `active` | `planned`

### Governance Rule
If `canon_status = frozen` (from P1 source), governance fields are **immutable** — no lower-precedence source can override.

---

## API Endpoints (17 verified)

### Core
- `GET /` — Dashboard
- `GET /sessions` — Session list
- `GET /lanes` — Lane list
- `GET /ecosystem` — Ecosystem state
- `GET /decisions` — Decision log
- `GET /health` — Health check (version, modules, endpoints)

### Prompt Bridge
- `GET /bridge` — Bridge UI
- `GET /bridge/api/pack?session=SESSION_ID` — Generate Master Architect Pack
- `GET /bridge/api/ecosystem` — Ecosystem context
- `GET /bridge/api/repo` — Repo authority context
- `GET /bridge/api/session?id=SESSION_ID` — Session context
- `GET /bridge/api/lane?id=LANE_ID` — Lane context
- `GET /bridge/api/decisions?type=session&id=X` — Decision summary
- `POST /bridge/api/ingest` — Ingest execution closeout (JSON)
- `POST /bridge/ingest` — Ingest closeout (form)

### Sovereign Intake
- `GET /sovereign` — Sovereign Intake UI
- `POST /sovereign/api/ingest` — Ingest raw markdown `{ doc_id, doc_type, content }`
- `GET /sovereign/api/summary` — Intake summary + active source status
- `GET /sovereign/api/payload?id=DOC_ID` — Full normalized payload
- `GET /sovereign/api/list` — List all ingested documents
- `GET /sovereign/api/sessions?id=DOC_ID` — Extracted session truth
- `GET /sovereign/api/governance` — Governance/canon truth
- `GET /sovereign/api/merge?session=SESSION_ID` — Merged truth context
- `GET /sovereign/api/normalize?status=TEXT` — Normalize status string
- `GET /sovereign/api/raw?id=DOC_ID` — Raw document text
- `POST /sovereign/api/clear` — Clear intake store

---

## Data Architecture

**Persistence:** In-memory (resets on redeploy)

**Domain Model:**
- `Session` — planned/hard_cap/actual BU, status, blocker, signals
- `Lane` — budget rollup, health (healthy/watch/overloaded/frozen)
- `Ecosystem` — total cap, freeze rules, pressure level
- `DecisionLog` — go/stop/freeze/split history
- `SovereignIntakePayload` — normalized doc truth (source_meta, session_truth, governance_truth, repo_truth, etc.)

**Budget Logic:**
- Cap Status: safe (<80%) / warning (80-99%) / exceeded (≥100%)
- Signals: GO / WATCH / STOP

---

## User Guide

### Ingest current-handoff
1. Open https://lane-eco-budget-control.pages.dev/sovereign
2. Enter Document ID (e.g. `current-handoff-2026-04-15`)
3. Select type: `current-handoff (P1 — Canonical)`
4. Paste raw markdown content
5. Click **Ingest Document**

### Generate Grounded Context Pack
1. Open https://lane-eco-budget-control.pages.dev/bridge
2. Check Sovereign Source banner (should show active P1 source)
3. Select target session
4. Click **Generate Context Pack**
5. Copy and paste into Master Architect Prompt conversation

### Ingest Execution Closeout
After AI Dev completes work:
1. Open `/bridge` → **Ingest Execution Closeout** form
2. Fill session ID, final status, actual burn, output
3. Submit → closes planning→execution loop

---

## Deployment

| Item | Status |
|---|---|
| Platform | Cloudflare Pages |
| Build | ✅ 185.34 kB (48 modules) |
| GitHub | ✅ ganihypha/Lane-eco-budget-control-system (main) |
| Live | ✅ LIVE-VERIFIED (17/17 routes 200 OK) |
| Last Deploy | HUB-18 (2026-04-15) |

---

## Session History

| Session | Scope | Status | Build |
|---|---|---|---|
| HUB-16 | Budget Controller MVP Greenfield | LIVE-VERIFIED ✅ | v1.0.0 |
| HUB-17 | Prompt Bridge v1.0 (Phase A+B+C) | LIVE-VERIFIED ✅ | v1.1.0 |
| HUB-18 | Sovereign Source Intake v1.0 (Phase D) | LIVE-VERIFIED ✅ | v1.2.0 |

---

## Next Possible Steps (Optional)

1. **Cloudflare D1 Persistence** — swap in-memory BudgetStore for D1 SQLite
2. **BarberKas Lane Sessions** — start tracking sessions in lane-002
3. **Supabase Integration** — external persistence for sovereignty across restarts
4. **Automated Doc Fetch** — fetch `current-handoff` from GitHub repo on load
