# Lane-Eco Budget Control System

**Version:** 1.2.1 | **Build Session:** HUB-19 | **Status:** ✅ LIVE-VERIFIED

Internal operational tool for session, lane, ecosystem budget management — with truth-mature Sovereign Source Intake for canonical truth grounding.

---

## Live URLs

- **Production:** https://lane-eco-budget-control.pages.dev
- **Prompt Bridge:** https://lane-eco-budget-control.pages.dev/bridge
- **Sovereign Intake:** https://lane-eco-budget-control.pages.dev/sovereign
- **GitHub:** https://github.com/ganihypha/Lane-eco-budget-control-system

---

## Modules (7 total — all LIVE-VERIFIED)

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
Sovereign Source (P1 current-handoff)          ← canonical truth
         ↓
Budget Controller App (P3 — operational truth surface)
         ↓
Prompt Bridge (context export + pack generator)
         ↓
Master Architect Context Pack (truth-mature, 17+ sections)
   - Truth Maturity badge: NONE/LOW/MEDIUM/HIGH
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
| P3 | live controller | Budget Controller app state |
| P4 | repo/deploy | GitHub + Cloudflare runtime |
| P5 | notes | Conversational context (lowest) |

---

## Sovereign Source Intake — HUB-19 (Truth-Maturity Upgrade)

### Parser Capabilities (Section-Aware)

All session block patterns supported:
```
SESSION 4G                    # bare SESSION with alphanumeric ID
## SESSION 4A                 # heading-based
## 🚀 SESSION 4B              # emoji + heading
## SESSION 4A — HUB-18        # compound heading
HUB-17, HUB-18, SES-01       # hub/ses prefixed
```

Status normalization:
```
STATUS: VERIFIED & CLOSED       → closed_verified
STATUS: LIVE-VERIFIED           → live_verified
STATUS: DEPLOYED AND E2E VERIFIED → e2e_verified
STATUS: BUILD-VERIFIED          → build_verified
STATUS: VERIFIED AND READY TO CLOSE → verified_ready_to_close
STATUS: PARTIAL                 → partial
STATUS: BLOCKED                 → blocked
```

Repo/Deploy truth patterns:
```
Repo: <url>
Production: <url>
Cloudflare: <host>
Live URL: <url>
GitHub: <url>
build_session: hubXX
```

### Evidence-Based Confidence Scoring (7 Dimensions)

| Dimension | Meaning |
|---|---|
| valid_source_type | doc_type = current-handoff or active-priority |
| session_blocks_found | ≥1 session block extracted |
| governance_found | Governance Canon section found |
| repo_deploy_found | Repo/live URL found |
| next_move_found | Next Locked Move / Suggested scope found |
| module_truth_found | Module/route table found |
| conflicts_resolved_cleanly | No unresolved conflicts |

Scoring: HIGH=5+/7, MEDIUM=3-4/7, LOW=1-2/7, NONE=0/7

### URL Sanitization

- `safe_source_id` = doc_id only, never a URL or endpoint
- `_restricted_endpoints_redacted: true` always set
- tokenized/webhook/preview-hash URLs filtered from evidence_links
- Separated concepts: source_doc_id, canonical_product_repo, canonical_live_url, evidence_urls, (restricted never rendered)

### Fallback Rendering Honesty

Text pack uses explicit labels:
- `[canonical_truth (P1 — doc-id)]` — field from P1 source
- `[controller_fallback (P3 hardcoded)]` — P3 fallback applied
- `unresolved — not found in canonical source` — instead of silent null
- `FROZEN 🔒 (IMMUTABLE)` — for immutable governance canon

---

## How to Use

1. **Ingest current-handoff**: Open `/sovereign`, paste raw markdown, select `current-handoff (P1)`, click **Ingest & Parse Document**
2. **Check truth maturity**: Badge shows NONE/LOW/MEDIUM/HIGH + 7-dimension score
3. **Review extraction completeness**: Grid shows what was/wasn't found
4. **Check merge diagnostics**: canonical fields vs fallback fields vs unresolved
5. **Generate pack**: Open `/bridge` → sovereign banner shows maturity → click **Generate Context Pack**
6. **Copy pack**: Text pack has per-field provenance — safe to paste to AI sessions
7. **Closeout**: After AI Dev work, ingest closeout at `/bridge` to close the loop

---

## Deployment

- **Platform:** Cloudflare Pages (edge-deployed, global)
- **Status:** ✅ LIVE-VERIFIED
- **Tech Stack:** Hono + TypeScript + TailwindCSS CDN
- **Last Updated:** 2026-04-15 (HUB-19)
- **GitHub:** https://github.com/ganihypha/Lane-eco-budget-control-system

## Sessions History

| Session | Status | Description |
|---|---|---|
| HUB-16 | LIVE-VERIFIED | Budget Controller MVP greenfield build |
| HUB-17 | LIVE-VERIFIED | Prompt Bridge v1.0 Phase A+B+C |
| HUB-18 | LIVE-VERIFIED | Sovereign Source Intake v1.0 |
| HUB-19 | LIVE-VERIFIED | Truth-Maturity Upgrade — section-aware parser + evidence-based confidence |
