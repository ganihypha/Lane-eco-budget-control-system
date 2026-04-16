# Lane-Eco Budget Control System

**Version:** 1.5.0 | **Build Session:** HUB-23 | **Status:** ✅ LIVE-DEPLOYED

Internal operational tool for session, lane, ecosystem budget management — with truth-mature Sovereign Source Intake, **persistent D1 storage**, **D1-durable webhook audit log**, and **D1-durable queue audit state** that survive Cloudflare Worker cold starts and instance changes.

---

## Live URLs

- **Production:** https://lane-eco-budget-control.pages.dev
- **Prompt Bridge:** https://lane-eco-budget-control.pages.dev/bridge
- **Sovereign Intake:** https://lane-eco-budget-control.pages.dev/sovereign
- **Webhook Handler:** https://lane-eco-budget-control.pages.dev/sovereign/api/webhook/inbound
- **GitHub:** https://github.com/ganihypha/Lane-eco-budget-control-system

---

## Modules (7 core + webhook/queue — all LIVE-DEPLOYED)

| Module | Route | Status |
|---|---|---|
| Dashboard | `/` | ✅ LIVE-VERIFIED |
| Sessions | `/sessions` | ✅ LIVE-VERIFIED |
| Lanes | `/lanes` | ✅ LIVE-VERIFIED |
| Ecosystem | `/ecosystem` | ✅ LIVE-VERIFIED |
| Decision Log | `/decisions` | ✅ LIVE-VERIFIED |
| Prompt Bridge | `/bridge` | ✅ LIVE-VERIFIED |
| Sovereign Intake | `/sovereign` | ✅ LIVE-VERIFIED |
| Webhook Handler | `/sovereign/api/webhook/inbound` | ✅ LIVE-DEPLOYED (PARTIAL — WEBHOOK_SECRET set, awaiting validated external caller) |
| Batch Queue | `/sovereign/api/queue/status` | ✅ CONTROLLED_VERIFIED |

---

## HUB-22: Webhook Secret Hardening

### WEBHOOK_SECRET Validation Classification

| Token Result | Condition | HTTP | Action |
|---|---|---|---|
| `VALIDATED` | Secret configured + token correct | 200 | Event queued |
| `INVALID_TOKEN` | Secret configured + token wrong | 401 | Rejected |
| `MISSING_TOKEN` | Secret configured + no token | 401 | Rejected |
| `SECRET_NOT_CONFIGURED` | No secret env var | 200 | Accepted w/ warning (open) |

### Configure WEBHOOK_SECRET (Production)
```bash
npx wrangler pages secret put WEBHOOK_SECRET --project-name lane-eco-budget-control
```

### Send Validated Webhook Event
```bash
curl -X POST https://lane-eco-budget-control.pages.dev/sovereign/api/webhook/inbound \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Token: YOUR_SECRET_HERE" \
  -d '{"event_type":"budget.approval","source":"external-system"}'
```

### Batch Queue States
`pending` → `processing` → `approved` → `sent` / `failed`

Queue items carry `origin` field: `webhook_inbound` (real) | `test_scenario` (controlled)

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
Webhook Inbound Handler ← external events (WEBHOOK_SECRET validated)
  ↓
Batch Queue (pending → processing → approved → sent/failed)
  ↓
Prompt Bridge (context export + pack generator)
  ↓
Master Architect Context Pack (truth-mature, sovereign-grounded)
```

---

## API Endpoints

### Core Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | System health (version, webhook_secret_configured, storage_mode) |
| `/sovereign/api/ingest` | POST | Ingest canonical P1 document |
| `/sovereign/api/summary` | GET | Intake summary + persistence status |
| `/sovereign/api/payload?id=X` | GET | Full normalized payload |
| `/sovereign/api/merge?session=X` | GET | Merged truth context |
| `/bridge/api/pack` | GET | Master Architect Context Pack (JSON) |
| `/bridge/api/pack?session=X` | GET | Session-specific pack |

### HUB-22/23 Webhook + Queue (D1-Durable)
| Endpoint | Method | Description |
|---|---|---|
| `/sovereign/api/webhook/inbound` | POST | Secure webhook handler (WEBHOOK_SECRET) + D1 audit |
| `/sovereign/api/webhook/log` | GET | D1-durable audit log (survives cold starts) |
| `/sovereign/api/queue/status` | GET | D1-durable queue status |
| `/sovereign/api/queue/process` | POST | Queue transition (persisted to D1) |
| `/sovereign/api/queue/audit` | GET | Full D1 durable audit trace (NEW HUB-23) |
| `/sovereign/api/queue/test` | POST | Controlled E2E test (D1-persisted) |

---

## HUB History

| Session | Description | Status |
|---|---|---|
| HUB-17 | Prompt Bridge v1.0 | ✅ LIVE-VERIFIED |
| HUB-18 | Sovereign Source Intake v1.0 | ✅ LIVE-VERIFIED |
| HUB-19 | Truth-Maturity Upgrade (section parser + confidence scoring) | ✅ LIVE-VERIFIED |
| HUB-20 | Persistent D1 storage + boot restore | ✅ LIVE-VERIFIED |
| HUB-21 | Final truth-layer cleanup + webhook/queue scaffolding | ✅ LIVE-DEPLOYED |
| HUB-22 | Webhook Secret Hardening + Live Integration | ✅ LIVE-DEPLOYED |
| HUB-23 | Durable Webhook/Queue Audit + Boot Consistency Fix | ✅ LIVE-DEPLOYED |

---

## Honest Classification (HUB-23)

| Component | Classification | Notes |
|---|---|---|
| Truth Layer (D1 + boot restore) | ✅ LIVE-VERIFIED | Survives cold boots |
| Sovereign Source Intake | ✅ LIVE-VERIFIED | P1 auto-restored on boot |
| Boot consistency (/health vs /summary) | ✅ LIVE-VERIFIED | _globalInitPromise fix |
| Webhook MISSING_TOKEN reject + D1 audit | ✅ LIVE-VERIFIED | Proven on production |
| Webhook INVALID_TOKEN reject + D1 audit | ✅ LIVE-VERIFIED | Proven on production |
| Webhook log durability (cold boot) | ✅ LIVE-VERIFIED | D1 storage_layer confirmed |
| Queue audit durability (cold boot) | ✅ LIVE-VERIFIED | D1 storage_layer confirmed |
| Queue full cycle pending→sent | ✅ LOCAL-VERIFIED | E2E + D1 audit proven locally |
| Token VALIDATED from real external caller | ⚠️ PARTIAL | Needs external caller with prod secret |

**Next Locked Move:**
1. Configure external system to send `POST /sovereign/api/webhook/inbound` with `X-Webhook-Token: <WEBHOOK_SECRET>`
2. Verify `token_result: VALIDATED` in response → webhook = LIVE_VERIFIED
3. Confirm queue item with `origin: webhook_inbound` flows to `sent` → batch queue = LIVE_VERIFIED

---

## Deployment

- **Platform:** Cloudflare Pages  
- **D1 Database:** `lane-eco-sovereign-store` (8c11a290-5211-4e26-a8ac-cc2cc0227b24)
- **Secrets configured:** `WEBHOOK_SECRET` ✅
- **Last deploy:** HUB-22
