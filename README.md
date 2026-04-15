# Lane-Eco Budget Control System

**Version:** 1.3.1 | **Build Session:** HUB-21 | **Status:** ✅ LIVE-VERIFIED

Internal operational tool for session, lane, ecosystem budget management — with truth-mature Sovereign Source Intake and **persistent D1 storage** for canonical truth grounding that survives restarts and redeployment.

---

## Live URLs

- **Production:** https://lane-eco-budget-control.pages.dev
- **Prompt Bridge:** https://lane-eco-budget-control.pages.dev/bridge
- **Sovereign Intake:** https://lane-eco-budget-control.pages.dev/sovereign
- **GitHub:** https://github.com/ganihypha/Lane-eco-budget-control-system

---

## Modules (7 total — all LIVE-VERIFIED / 17/17 routes 200 OK)

| Module | Route | Description |
|---|---|---|
| Dashboard | `/` | Budget overview, signals, recommended actions |
| Sessions | `/sessions` | CRUD + budget tracking per session |
| Lanes | `/lanes` | Lane health + budget rollup |
| Ecosystem | `/ecosystem` | Total cap, freeze rules, pressure level |
| Decision Log | `/decisions` | Historical go/stop/freeze decisions |
| Prompt Bridge | `/bridge` | Generate Master Architect Context Pack (truth-grounded) |
| Sovereign Intake | `/sovereign` | Ingest canonical current-handoff + truth-maturity analysis |

---

## Architecture

```
Sovereign Source (P1 current-handoff) ← canonical truth
  ↓
Sovereign Source Intake (D1 persistent storage)
  ↓  [persists across restart/redeploy]
Auto-Restore on Boot (restores P1 from D1 on first request)
  ↓
Budget Controller App (P3 — operational truth surface)
  ↓
Prompt Bridge (context export + pack generator)
  ↓
Master Architect Context Pack (truth-mature, 17+ sections)
  - Truth Maturity badge: NONE/LOW/MEDIUM/HIGH
  - Storage Mode: persistent (D1) / in-memory / degraded
  - Active source restored on boot: YES/NO
  - Per-field provenance: [canonical_truth P1] / [controller_fallback P3]
  - Governance frozen: IMMUTABLE label
  - Extraction completeness summary
  - Merge diagnostics panel
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
| P3 | live controller | Budget Controller state (budget, sessions, lanes) |
| P4 | repo/deploy | Repo + live URL truth |
| P5 | notes/manual | Low-weight conversational context |

---

## HUB-21 Upgrade (Final Hardening + Webhook + Batch Queue)

### What was upgraded

1. **Final Truth-Layer Cleanup**
   - `session_status_override`: disambiguate `not_applicable` (no session_id requested) vs `unresolved` (session not in P1 doc)
   - New field `session_status_override_note` in `MergedTruthContext` for clear diagnostics
   - Pack text: sharper diagnostics section — priority_order always shown, clean/all-resolved label
   - `bridge.ts`: only pass session_id to merge if explicitly requested (fixes auto-pick misleading warning)
   - `unresolved_fields: []` when no session_id provided (correct — `not_applicable` ≠ `unresolved`)

2. **Cold Boot Consistency**
   - Added `init_complete` + `boot_consistency` flags to `/health` endpoint
   - `/health` and `/sovereign/api/summary` guaranteed consistent (same `sovereignStore` singleton)
   - Cold boot test: P1 auto-restored after restart, both endpoints report identical state

3. **Webhook Inbound Handler (STRUCTURE_VERIFIED)**
   - `POST /sovereign/api/webhook/inbound` — validates structure, logs event, hands off to queue
   - `GET /sovereign/api/webhook/log` — event log with honest classification
   - Honest classification: `STRUCTURE_VERIFIED` | `PARTIAL` (token present, no secret configured) | `REJECTED`

4. **Batch Queue Processing (CONTROLLED_VERIFIED)**
   - `GET /sovereign/api/queue/status` — queue depth + status breakdown
   - `POST /sovereign/api/queue/process` — manual state transitions
   - `POST /sovereign/api/queue/test` — controlled end-to-end scenario artifact
   - States verified: `pending → processing → approved → sent` + `failed` path
   - Honest: `CONTROLLED_VERIFIED`, pending `LIVE_VERIFIED` from real external caller

5. **Version bump:** 1.3.0 → 1.3.1 | build_session: hub21

---

## HUB-20 Upgrade (Persistent Storage + Boot Restore)

### What was upgraded

1. **Persistent Sovereign Intake Storage (D1)**
   - New `src/lib/sovereign-db.ts` — `SovereignDBAdapter` wrapping D1Database
   - Stores: source_meta, raw content (capped 64KB), all normalized domains, active_source_id
   - Graceful fallback: if D1 unavailable → in-memory + honest warning
   - `migrations/0001_sovereign_intake_store.sql`: 3 tables (records, active pointer, boot log)
   - Storage mode exposed: `persistent` | `in-memory` | `degraded`

2. **Auto-Restore Active P1 Source on Boot**
   - `SovereignDBAdapter.restoreActiveSource()`: restores most recent valid P1/P2 record
   - Restore conditions: precedence P1/P2 + confidence != 'none' + payload exists
   - If restore fails: honest warning state, never silent downgrade
   - Boot audit: `sovereign_boot_log` records every boot + result

3. **Harden Merge Honesty**
   - Bridge text pack: `Storage Mode: persistent` + `Restored on boot: YES/NO`
   - No silent P3 fallback when P1 is present

4. **Clean Up Low-Trust Defaults**
   - Epoch timestamp guard (never returns `1970-01-01T00:00:00.000Z`)
   - `controller_fallback_active`: explicit boolean in summary
   - `truth_authority`: `P1 — current-handoff (doc_id)` OR `controller_fallback (P3) only`

5. **Summary + Diagnostics Upgrade**
   - `/health`: +`storage_mode`, +`active_source_restored_on_boot`, version=1.3.0
   - `/sovereign/api/summary`: +persistence diagnostics
   - `/sovereign/api/ingest` response: +`persistence{storage_mode, note}`

6. **No LLM Dependency**
   - All restore/persist logic is deterministic D1 SQL

---

## User Guide

### Quick Start: Ground the Prompt Bridge in P1 Truth

1. Open https://lane-eco-budget-control.pages.dev/sovereign
2. Paste your `current-handoff` markdown content in the text area
3. Set doc_id (e.g. `handoff-2026-04-15`) and type `current-handoff`
4. Click **Ingest & Parse Document**
5. Check the **Truth Maturity** badge — target `HIGH` (7/7 dimensions)
6. Note `Storage Mode: persistent` — source will survive restart
7. Open `/bridge` → sovereign banner shows maturity badge + storage mode
8. Click **Generate Context Pack** → pack is truth-mature with provenance labels
9. Copy text pack → paste at start of new Master Architect session

### Boot Restore Behavior

- After any restart/redeploy, the most recent valid P1 source is automatically restored from D1
- `active_source_restored_on_boot: true` in health and summary confirms restore happened
- No manual re-ingest needed after restart

### Degraded Mode

- If no P1 source is ingested, pack will say `controller_fallback (P3) only`
- This is honest — never silent fallback to P3 while claiming P1 truth

---

## Data Architecture

**Data Models:**
- Session, Lane, Ecosystem, Decision (controller-owned, P3)
- SovereignIntakePayload: source_meta, session_truth[], module_truth[], governance_truth, repo_truth, next_move_truth (sovereign-owned, P1/P2)

**Storage Services:**
- **Cloudflare D1** (`lane-eco-sovereign-store`): Sovereign intake persistence
- **In-Memory (BudgetStore)**: Budget controller operational state

**Storage Bindings:**
- `SOVEREIGN_DB` → D1 database `lane-eco-sovereign-store` (ID: `8c11a290-5211-4e26-a8ac-cc2cc0227b24`)

---

## Deployment

- **Platform:** Cloudflare Pages
- **Project:** `lane-eco-budget-control`
- **Status:** ✅ Active — 17/17 routes LIVE-VERIFIED
- **Tech Stack:** Hono + TypeScript + TailwindCSS (CDN) + Cloudflare D1
- **Build:** `npm run build` → `dist/_worker.js` (215 kB)
- **Last Updated:** 2026-04-15 — HUB-20 persistent storage upgrade

## Session History

| Session | Status | Achievement |
|---|---|---|
| HUB-16 | ✅ closed | Greenfield build: Dashboard, Sessions, Lanes, Ecosystem, Decisions |
| HUB-17 | ✅ closed | Prompt Bridge v1.0 — Phase A+B+C, 12/12 routes |
| HUB-18 | ✅ closed | Sovereign Source Intake v1.0 — 17/17 routes |
| HUB-19 | ✅ closed | Truth-Maturity Upgrade — section-aware parser, evidence-based scoring |
| HUB-20 | ✅ live | Persistent D1 Storage + Boot Restore + Harden Merge Honesty |
