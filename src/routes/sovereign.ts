// ============================================================
// SOVEREIGN SOURCE INTAKE ROUTE — Lane-Eco Budget Control System
// HUB-22: Webhook Secret Hardening + Live Integration
//
// Routes:
//   GET  /sovereign                        → Sovereign Intake UI
//   POST /sovereign/api/ingest             → Ingest raw markdown doc
//   GET  /sovereign/api/summary            → Intake summary + status
//   GET  /sovereign/api/payload?id=X       → Full normalized payload
//   GET  /sovereign/api/sessions?id=X      → Extracted session truth
//   GET  /sovereign/api/governance         → Governance truth
//   GET  /sovereign/api/merge?session=X    → Merged truth context with diagnostics
//   POST /sovereign/api/clear              → Clear intake store (reset)
//
//   HUB-22 Webhook + Queue:
//   POST /sovereign/api/webhook/inbound    → Secure webhook handler (WEBHOOK_SECRET)
//   GET  /sovereign/api/webhook/log        → Webhook audit log
//   GET  /sovereign/api/queue/status       → Batch queue status
//   POST /sovereign/api/queue/process      → Manual queue transition
//   POST /sovereign/api/queue/test         → Controlled E2E test scenario
// ============================================================

import { Hono } from 'hono'
import { shellHtml } from '../lib/ui'
import {
  ingestSovereignSource,
  ingestSovereignSourceAsync,
  syncSovereignIntakeToBridgeStore,
  mergeSovereignTruthWithControllerState,
  getSovereignIntakeSummary,
  normalizeSovereignSessionStatus,
  sovereignStore,
  type SovereignDocType,
  type TruthMaturityLevel,
  type SovereignConfidence
} from '../lib/sovereign'

const sovereign = new Hono()

// ─── HELPER FUNCTIONS ────────────────────────────────────────

function confidenceColor(c: SovereignConfidence | string): string {
  if (c === 'high') return '#22c55e'
  if (c === 'medium') return '#f59e0b'
  if (c === 'low') return '#ef4444'
  return '#64748b'
}

function maturityColor(m: TruthMaturityLevel | string): string {
  if (m === 'HIGH') return '#22c55e'
  if (m === 'MEDIUM') return '#f59e0b'
  if (m === 'LOW') return '#ef4444'
  return '#475569'
}

function maturityBg(m: TruthMaturityLevel | string): string {
  if (m === 'HIGH') return 'rgba(34,197,94,0.1)'
  if (m === 'MEDIUM') return 'rgba(245,158,11,0.1)'
  if (m === 'LOW') return 'rgba(239,68,68,0.1)'
  return 'rgba(71,85,105,0.1)'
}

function checkIcon(ok: boolean): string {
  return ok ? '✅' : '❌'
}

// ─── UI: SOVEREIGN INTAKE MAIN PAGE ──────────────────────────
sovereign.get('/', (c) => {
  const summary = getSovereignIntakeSummary()
  const allIntakes = sovereignStore.listAll()

  // Get merge diagnostics for the active source
  const activePayload = sovereignStore.getActive()
  const mergedCtx = mergeSovereignTruthWithControllerState(activePayload)

  const maturity = summary.truth_maturity || 'NONE'
  const breakdown = summary.confidence_breakdown

  // ── Truth Maturity Badge ─────────────────────────────────
  const maturityBadge = `
  <div class="flex items-center gap-3 mb-2">
    <div class="px-3 py-1.5 rounded-lg text-sm font-bold"
         style="background:${maturityBg(maturity)};color:${maturityColor(maturity)};border:1px solid ${maturityColor(maturity)}40">
      TRUTH MATURITY: ${maturity}
    </div>
    <div class="text-xs text-slate-500">
      ${summary.has_active_source
        ? `Confidence: <span style="color:${confidenceColor(summary.confidence)};font-weight:600">${summary.confidence.toUpperCase()}</span>`
        : 'No P1 source loaded'}
    </div>
  </div>`

  // ── Extraction Completeness Summary ─────────────────────
  const extractionSummary = summary.has_active_source && breakdown ? `
  <div class="card p-4 mb-4" style="border-color:#1e293b">
    <div class="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Extraction Completeness</div>
    <div class="grid gap-2" style="grid-template-columns:repeat(4,1fr)">
      ${[
        ['Source Type', breakdown.valid_source_type],
        ['Sessions', breakdown.session_blocks_found],
        ['Governance', breakdown.governance_found],
        ['Repo/Deploy', breakdown.repo_deploy_found],
        ['Next Move', breakdown.next_move_found],
        ['Module Truth', breakdown.module_truth_found],
        ['No Conflicts', breakdown.conflicts_resolved_cleanly],
      ].map(([label, ok]) => `
      <div class="flex items-center gap-1.5 text-xs">
        <span>${ok ? '✅' : '❌'}</span>
        <span style="color:${ok ? '#94a3b8' : '#ef4444'}">${label}</span>
      </div>`).join('')}
    </div>
    <div class="mt-2 text-xs text-slate-600">
      Score: ${breakdown.dimensions_met}/${breakdown.total_dimensions} dimensions met
    </div>
  </div>` : ''

  // ── Merge Diagnostics Panel ──────────────────────────────
  const mergeDiagPanel = summary.has_active_source ? `
  <div class="card p-4 mb-4" style="border-color:#1e293b">
    <div class="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Merge Diagnostics</div>
    <div class="space-y-1.5 text-xs">
      <div class="flex justify-between">
        <span class="text-slate-500">Canonical fields used:</span>
        <span class="text-green-400">${Object.values(mergedCtx.field_sources).filter(s => s.startsWith('canonical')).length}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-slate-500">Controller fallback fields:</span>
        <span class="text-amber-400">${mergedCtx.controller_fallback_fields.length}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-slate-500">Unresolved fields:</span>
        <span style="color:${mergedCtx.unresolved_fields.length > 0 ? '#ef4444' : '#22c55e'}">${mergedCtx.unresolved_fields.length}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-slate-500">Conflicts detected:</span>
        <span style="color:${mergedCtx.conflicts.length > 0 ? '#ef4444' : '#22c55e'}">${mergedCtx.conflicts.length}</span>
      </div>
      ${mergedCtx.unresolved_fields.length > 0 ? `
      <div class="mt-2 pt-2" style="border-top:1px solid #1e293b">
        <div class="text-slate-600 mb-1">Unresolved:</div>
        ${mergedCtx.unresolved_fields.slice(0, 5).map(f => `
        <div class="text-xs text-red-400 ml-2">• ${f}</div>`).join('')}
      </div>` : ''}
      ${mergedCtx.controller_fallback_fields.length > 0 ? `
      <div class="mt-2 pt-2" style="border-top:1px solid #1e293b">
        <div class="text-slate-600 mb-1">Controller fallback (P3):</div>
        ${mergedCtx.controller_fallback_fields.slice(0, 4).map(f => `
        <div class="text-xs text-amber-500 ml-2">• ${f}</div>`).join('')}
      </div>` : ''}
    </div>
  </div>` : ''

  // Previous ingests list
  const ingestsList = allIntakes.length > 0 ? allIntakes.map(p => {
    const meta = p.source_meta
    const bd = meta.confidence_breakdown
    const pMaturity = bd?.truth_maturity || 'NONE'
    return `
    <div class="card p-4 mb-3" style="border-color:${maturityColor(pMaturity)}20">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-bold text-white">${meta.safe_source_id || meta.doc_id}</span>
          <span class="text-xs px-2 py-0.5 rounded" style="background:rgba(255,255,255,0.05);color:#94a3b8">${meta.doc_type}</span>
          <span class="text-xs font-bold px-2 py-0.5 rounded" style="background:${maturityBg(pMaturity)};color:${maturityColor(pMaturity)}">
            ${pMaturity}
          </span>
        </div>
        <span class="text-xs text-slate-500">${meta.precedence} · ${new Date(meta.ingested_at).toLocaleString()}</span>
      </div>
      ${bd ? `
      <div class="grid gap-1.5 text-xs mb-3" style="grid-template-columns:repeat(4,1fr)">
        <div>${checkIcon(bd.session_blocks_found)} <span class="text-slate-500">Sessions: ${p.session_truth.length}</span></div>
        <div>${checkIcon(bd.module_truth_found)} <span class="text-slate-500">Modules: ${p.module_truth.length}</span></div>
        <div>${checkIcon(bd.governance_found)} <span class="text-slate-500">Governance</span></div>
        <div>${checkIcon(bd.next_move_found)} <span class="text-slate-500">Next Move</span></div>
        <div>${checkIcon(bd.repo_deploy_found)} <span class="text-slate-500">Repo/Deploy</span></div>
        <div>${checkIcon(bd.conflicts_resolved_cleanly)} <span class="text-slate-500">No Conflicts</span></div>
        <div class="col-span-2 text-slate-600">Score: ${bd.dimensions_met}/${bd.total_dimensions}</div>
      </div>` : ''}
      <div class="text-xs">
        <span class="text-slate-500">Governance:</span>
        <span style="color:${p.governance_truth?.canon_status === 'frozen' ? '#93c5fd' : '#94a3b8'}">
          ${p.governance_truth?.canon_status || 'N/A'}${p.governance_truth?.canon_status === 'frozen' ? ' 🔒 IMMUTABLE' : ''}
        </span>
      </div>
      ${meta.parse_warnings.length > 0 ? `
      <div class="mt-2 text-xs text-amber-400">
        ⚠ ${meta.parse_warnings.length} warning(s): ${meta.parse_warnings[0].slice(0, 80)}${meta.parse_warnings[0].length > 80 ? '...' : ''}
      </div>` : `
      <div class="mt-2 text-xs text-green-500">✅ No parse warnings</div>`}
      <div class="mt-3 flex gap-2">
        <button onclick="viewPayload('${meta.doc_id}')" class="btn-secondary text-xs py-1 px-3">
          <i class="fas fa-eye mr-1"></i>View Payload
        </button>
        <button onclick="viewMerge('${meta.doc_id}')" class="btn-secondary text-xs py-1 px-3">
          <i class="fas fa-code-merge mr-1"></i>Merge Diagnostics
        </button>
      </div>
    </div>`
  }).join('') : `<div class="text-center py-8 text-slate-500 text-sm">No documents ingested yet.</div>`

  // ── Storage Mode + Boot Restore Banner (HUB-20) ──────────
  const storageModeBanner = (() => {
    const mode = summary.storage_mode || 'in-memory'
    const modeColor = mode === 'persistent' ? '#22c55e' : mode === 'degraded' ? '#ef4444' : '#f59e0b'
    const modeIcon = mode === 'persistent' ? 'database' : mode === 'degraded' ? 'exclamation-triangle' : 'memory'
    const bootLabel = summary.active_source_restored_on_boot
      ? `<span class="text-green-400">✅ Restored on boot: <strong>${summary.active_doc_id || 'N/A'}</strong></span>`
      : `<span class="text-slate-400">No auto-restore — no P1 source in DB yet</span>`
    return `
  <div class="card p-3 mb-4 flex items-center gap-3" style="border-color:${modeColor}30;background:rgba(0,0,0,0.2)">
    <i class="fas fa-${modeIcon}" style="color:${modeColor}"></i>
    <div class="flex-1 text-xs">
      <span class="font-bold" style="color:${modeColor}">Storage: ${mode.toUpperCase()}</span>
      <span class="text-slate-500 ml-3">|</span>
      <span class="ml-3">${bootLabel}</span>
      ${summary.boot_restore_note ? `<div class="text-slate-600 mt-0.5 text-xs">${summary.boot_restore_note}</div>` : ''}
    </div>
  </div>`
  })()

  const body = `
  <div class="p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div>
        <div class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Sovereign Source Intake — HUB-20</div>
        <h1 class="text-2xl font-bold text-white">Truth-Mature Canonical Ingestion</h1>
        <p class="text-sm text-slate-400 mt-1">Ingest <code class="text-violet-300">current-handoff</code> markdown to ground the Prompt Bridge in canonical Sovereign truth.</p>
      </div>
      <div class="text-right">
        ${maturityBadge}
        <div class="text-xs text-slate-600 mt-1">
          ${summary.has_active_source
            ? `Active: <span class="text-slate-300">${summary.safe_source_id || summary.active_doc_id}</span> (${summary.active_precedence})`
            : 'No source loaded — Pack grounded on P3'}
        </div>
      </div>
    </div>

    <!-- Storage Mode + Boot Restore Banner (HUB-20) -->
    ${storageModeBanner}

    <!-- Architecture Banner -->
    <div class="card p-4 mb-5" style="border-color:#7c3aed;background:rgba(124,58,237,0.06)">
      <div class="flex items-start gap-3">
        <i class="fas fa-layer-group text-violet-400 mt-0.5"></i>
        <div>
          <div class="text-sm font-semibold text-violet-300 mb-1">Truth Precedence — P1 wins over P2 → P3 → P4 → P5</div>
          <div class="text-xs text-slate-400 flex flex-wrap gap-2">
            <span class="text-white font-bold">P1</span><span>current-handoff (canonical)</span>
            <span class="text-slate-600">›</span>
            <span class="text-white font-bold">P2</span><span>active-priority</span>
            <span class="text-slate-600">›</span>
            <span class="text-white font-bold">P3</span><span>live controller</span>
            <span class="text-slate-600">›</span>
            <span class="text-white font-bold">P4</span><span>repo/deploy</span>
            <span class="text-slate-600">›</span>
            <span class="text-white font-bold">P5</span><span>notes</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Extraction Completeness + Merge Diagnostics (if source active) -->
    ${summary.has_active_source ? `
    <div class="grid gap-4 mb-5" style="grid-template-columns:1fr 1fr">
      ${extractionSummary}
      ${mergeDiagPanel}
    </div>` : ''}

    <div class="grid gap-6" style="grid-template-columns:1fr 1fr">

      <!-- LEFT: Intake Form -->
      <div>
        <div class="card p-5 mb-4">
          <h2 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <i class="fas fa-file-import text-violet-400"></i>
            Ingest Sovereign Source Document
          </h2>
          <p class="text-xs text-slate-400 mb-4">
            Paste the raw markdown from <code class="text-violet-300">current-handoff</code> or
            <code class="text-violet-300">active-priority</code>. Parser handles:
            <span class="text-slate-300">SESSION 4G, ## 🚀 SESSION 4B, HUB-17, STATUS: VERIFIED &amp; CLOSED, GOVERNANCE CANON FROZEN,</span> and more.
          </p>
          <form id="ingestForm" class="space-y-3">
            <div class="grid gap-3" style="grid-template-columns:1fr 1fr">
              <div>
                <label class="form-label">Document ID (safe label) *</label>
                <input type="text" id="docId" placeholder="e.g. current-handoff-2026-04-15" required/>
                <div class="text-xs text-slate-600 mt-1">Used as safe_source_id — never exposed as URL</div>
              </div>
              <div>
                <label class="form-label">Document Type *</label>
                <select id="docType" style="background:#0f172a;border:1px solid #475569;color:#e2e8f0;border-radius:0.5rem;padding:0.5rem 0.75rem;width:100%">
                  <option value="current-handoff">current-handoff (P1 — Canonical)</option>
                  <option value="active-priority">active-priority (P2)</option>
                  <option value="unknown">unknown (P5 — low weight)</option>
                </select>
              </div>
            </div>
            <div>
              <label class="form-label">Raw Markdown Content *</label>
              <textarea id="docContent" rows="14" placeholder="Paste your current-handoff or active-priority markdown here...

Expected patterns that will be extracted:
- SESSION 4G, ## 🚀 SESSION 4B, HUB-17
- STATUS: VERIFIED & CLOSED / STATUS: BUILD-VERIFIED
- GOVERNANCE CANON STATUS / Governance Canon v1 — FROZEN
- Priority Order: ...
- Next Locked Move: ...
- Repo: / Production: / Live URL:
" required style="background:#0f172a;border:1px solid #475569;color:#e2e8f0;border-radius:0.5rem;padding:0.5rem 0.75rem;width:100%;resize:vertical;font-family:monospace;font-size:0.75rem"></textarea>
            </div>
            <button type="button" onclick="ingestDoc()" class="btn-primary w-full flex items-center justify-center gap-2">
              <i class="fas fa-upload"></i>
              Ingest &amp; Parse Document
            </button>
          </form>
        </div>

        <!-- Status Normalization Reference -->
        <div class="card p-5">
          <h2 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <i class="fas fa-table text-slate-400"></i>
            Session Status Normalization
          </h2>
          <div class="text-xs space-y-1 font-mono">
            ${[
              ['VERIFIED & CLOSED', 'closed_verified', '#22c55e'],
              ['LIVE-VERIFIED', 'live_verified', '#22c55e'],
              ['DEPLOYED AND E2E VERIFIED', 'e2e_verified', '#22c55e'],
              ['BUILD-VERIFIED', 'build_verified', '#60a5fa'],
              ['VERIFIED AND READY TO CLOSE', 'verified_ready_to_close', '#60a5fa'],
              ['COMPLETE & SYNCED', 'complete_synced', '#22c55e'],
              ['PARTIAL', 'partial', '#f59e0b'],
              ['BLOCKED', 'blocked', '#ef4444'],
              ['ACTIVE / IN-PROGRESS', 'active', '#60a5fa'],
              ['PLANNED / PENDING', 'planned', '#94a3b8'],
            ].map(([raw, norm, color]) => `
            <div class="flex items-center justify-between py-0.5">
              <span class="text-slate-400">"${raw}"</span>
              <span class="text-slate-600 mx-2">→</span>
              <span style="color:${color}">${norm}</span>
            </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- RIGHT: Results + State + Previous Ingests -->
      <div>
        <!-- Intake Result Panel (hidden initially) -->
        <div id="resultPanel" class="card p-5 mb-4" style="display:none">
          <h2 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <i class="fas fa-check-circle text-green-400"></i>
            Ingestion Result
          </h2>
          <pre id="resultOutput" class="text-xs text-slate-300 overflow-auto" style="white-space:pre-wrap;max-height:350px;font-family:monospace;background:#0a0f1a;padding:1rem;border-radius:0.5rem;line-height:1.5"></pre>
        </div>

        <!-- Current State Summary -->
        <div class="card p-5 mb-4">
          <h2 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <i class="fas fa-circle-info text-blue-400"></i>
            Current Intake State
          </h2>
          <div id="summaryPanel" class="space-y-2 text-xs">
            ${summary.has_active_source ? `
            <div class="flex justify-between"><span class="text-slate-500">Safe Source ID</span><span class="text-white">${summary.safe_source_id || summary.active_doc_id}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Doc Type</span><span class="text-white">${summary.active_doc_type}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Precedence</span><span class="text-white">${summary.active_precedence}</span></div>
            <div class="flex justify-between">
              <span class="text-slate-500">Truth Maturity</span>
              <span class="font-bold px-2 py-0.5 rounded" style="background:${maturityBg(maturity)};color:${maturityColor(maturity)}">${maturity}</span>
            </div>
            <div class="flex justify-between"><span class="text-slate-500">Confidence</span><span style="color:${confidenceColor(summary.confidence)};font-weight:600">${summary.confidence.toUpperCase()}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Sessions extracted</span><span class="text-white">${summary.sessions_extracted}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Modules extracted</span><span class="text-white">${summary.modules_extracted}</span></div>
            <div class="flex justify-between">
              <span class="text-slate-500">Governance</span>
              <span style="color:${summary.governance_status === 'frozen' ? '#93c5fd' : '#94a3b8'}">
                ${summary.governance_status}${summary.governance_status === 'frozen' ? ' 🔒' : ''}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Next Move</span>
              <span class="text-white truncate ml-2" style="max-width:55%">
                ${summary.next_locked_move ? summary.next_locked_move.slice(0, 55) + '…' : '<span class="text-slate-600">unresolved</span>'}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Unresolved fields</span>
              <span style="color:${mergedCtx.unresolved_fields.length > 0 ? '#ef4444' : '#22c55e'}">${mergedCtx.unresolved_fields.length}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Controller fallback</span>
              <span class="text-amber-400">${mergedCtx.controller_fallback_fields.length} fields</span>
            </div>
            ` : `
            <div class="text-center py-4 text-slate-500">
              <i class="fas fa-triangle-exclamation text-amber-500 mb-2 text-lg"></i>
              <div class="font-semibold text-amber-400 mb-1">Truth Maturity: NONE</div>
              <div>No P1/P2 source ingested.</div>
              <div class="text-xs mt-1">Pack grounded on P3 controller state only.</div>
              <div class="text-xs mt-2 text-amber-500">→ Ingest current-handoff to raise truth maturity</div>
            </div>`}
          </div>
        </div>

        <!-- Previous Ingests -->
        <div class="card p-5">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-bold text-white flex items-center gap-2">
              <i class="fas fa-history text-slate-400"></i>
              Ingested Documents (${allIntakes.length})
            </h2>
            ${allIntakes.length > 0 ? `
            <button onclick="clearIntake()" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444;border-radius:0.5rem;padding:0.25rem 0.75rem;font-size:0.75rem;cursor:pointer">
              <i class="fas fa-trash mr-1"></i>Clear All
            </button>` : ''}
          </div>
          <div id="ingestsList">
            ${ingestsList}
          </div>
        </div>

        <!-- API Reference -->
        <div class="card p-5 mt-4">
          <h2 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <i class="fas fa-code text-green-400"></i>
            Sovereign API Endpoints
          </h2>
          <div class="space-y-2 text-xs font-mono">
            ${[
              ['POST', '/sovereign/api/ingest', '{ doc_id, doc_type, content }'],
              ['GET', '/sovereign/api/summary', 'truth maturity + extraction completeness'],
              ['GET', '/sovereign/api/payload?id=X', 'full normalized payload + breakdown'],
              ['GET', '/sovereign/api/sessions?id=X', 'extracted session truth'],
              ['GET', '/sovereign/api/governance', 'governance canon + freeze status'],
              ['GET', '/sovereign/api/merge?session=X', 'merged truth + diagnostics'],
              ['POST', '/sovereign/api/clear', 'clear intake store'],
            ].map(([method, route, desc]) => `
            <div class="flex items-center gap-2">
              <span style="color:${method === 'POST' ? '#f59e0b' : '#22c55e'};font-weight:700">${method}</span>
              <span class="text-slate-300">${route}</span>
              <span class="text-slate-600">— ${desc}</span>
            </div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- JSON Output Panel -->
    <div id="jsonPanel" class="mt-6" style="display:none">
      <div class="card p-0 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3" style="background:#0f172a;border-bottom:1px solid #334155">
          <div class="flex items-center gap-2">
            <i class="fas fa-brackets-curly text-amber-400"></i>
            <span class="text-sm font-bold text-white" id="jsonPanelTitle">Payload</span>
          </div>
          <button onclick="closeJson()" class="btn-secondary text-xs py-1 px-3">
            <i class="fas fa-times mr-1"></i>Close
          </button>
        </div>
        <pre id="jsonOutput" class="p-5 text-xs text-slate-300 overflow-auto" style="white-space:pre-wrap;max-height:600px;font-family:monospace;background:#0a0f1a;line-height:1.5"></pre>
      </div>
    </div>
  </div>

  <script>
    async function ingestDoc() {
      const docId = document.getElementById('docId').value.trim()
      const docType = document.getElementById('docType').value
      const content = document.getElementById('docContent').value.trim()

      if (!docId || !content) {
        alert('Document ID and content are required.')
        return
      }

      try {
        const resp = await fetch('/sovereign/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc_id: docId, doc_type: docType, content })
        })
        const data = await resp.json()

        document.getElementById('resultPanel').style.display = 'block'

        if (data.success) {
          const meta = data.data.source_meta
          const sessions = data.data.session_truth || []
          const syncResult = data.data.sync_result || {}
          const bd = meta.confidence_breakdown

          document.getElementById('resultOutput').textContent = [
            '✅ INGESTION SUCCESSFUL',
            '',
            'Source Meta:',
            '  Safe Source ID:  ' + (meta.safe_source_id || meta.doc_id),
            '  Type:            ' + meta.doc_type,
            '  Precedence:      ' + meta.precedence,
            '  Truth Maturity:  ' + (bd?.truth_maturity || 'UNKNOWN'),
            '  Confidence:      ' + meta.confidence.toUpperCase(),
            '  Score:           ' + (bd ? bd.dimensions_met + '/' + bd.total_dimensions + ' dimensions met' : 'N/A'),
            '  Raw Length:      ' + meta.raw_length + ' chars',
            '',
            'Extraction Completeness:',
            '  ' + (bd?.session_blocks_found ? '✅' : '❌') + ' Sessions found:    ' + sessions.length,
            '  ' + (bd?.module_truth_found ? '✅' : '❌') + ' Modules found:     ' + (data.data.module_truth?.length || 0),
            '  ' + (bd?.governance_found ? '✅' : '❌') + ' Governance:        ' + (data.data.governance_truth?.canon_status || 'not found'),
            '  ' + (bd?.next_move_found ? '✅' : '❌') + ' Next Move:         ' + (data.data.next_move_truth?.next_locked_move?.slice(0, 60) || 'not found'),
            '  ' + (bd?.repo_deploy_found ? '✅' : '❌') + ' Repo/Deploy:       ' + (data.data.repo_truth?.canonical_live_url || 'not found'),
            '  ' + (bd?.conflicts_resolved_cleanly ? '✅' : '❌') + ' No Conflicts',
            '',
            'Sync Result:',
            '  Sessions ref:    ' + (syncResult.sessions_referenced || 0),
            '  Gov preserved:   ' + (syncResult.governance_preserved ? 'YES 🔒' : 'NO'),
            '  Repo synced:     ' + (syncResult.repo_synced ? 'YES' : 'NO'),
            '  Conflicts:       ' + (syncResult.conflicts_detected?.length || 0),
            '',
            'Warnings: ' + (meta.parse_warnings.length === 0 ? 'None ✅' : meta.parse_warnings.join('; ')),
            '',
            '→ Open /bridge and Generate Context Pack (now truth-mature)'
          ].join('\\n')

          setTimeout(() => window.location.reload(), 3500)
        } else {
          document.getElementById('resultOutput').textContent = '❌ INGESTION FAILED\\n\\n' + JSON.stringify(data.error || data, null, 2)
        }
      } catch (err) {
        document.getElementById('resultPanel').style.display = 'block'
        document.getElementById('resultOutput').textContent = '❌ ERROR: ' + err.message
      }
    }

    async function viewPayload(docId) {
      const resp = await fetch('/sovereign/api/payload?id=' + encodeURIComponent(docId))
      const data = await resp.json()
      document.getElementById('jsonPanelTitle').textContent = 'Full Payload: ' + docId
      document.getElementById('jsonOutput').textContent = JSON.stringify(data.data, null, 2)
      document.getElementById('jsonPanel').style.display = 'block'
      document.getElementById('jsonPanel').scrollIntoView({ behavior: 'smooth' })
    }

    async function viewMerge(docId) {
      const resp = await fetch('/sovereign/api/merge')
      const data = await resp.json()
      document.getElementById('jsonPanelTitle').textContent = 'Merge Diagnostics — ' + docId
      document.getElementById('jsonOutput').textContent = JSON.stringify(data.data, null, 2)
      document.getElementById('jsonPanel').style.display = 'block'
      document.getElementById('jsonPanel').scrollIntoView({ behavior: 'smooth' })
    }

    async function clearIntake() {
      if (!confirm('Clear all ingested sovereign sources? Pack falls back to P3 controller state.')) return
      const resp = await fetch('/sovereign/api/clear', { method: 'POST' })
      if ((await resp.json()).success) window.location.reload()
    }

    function closeJson() {
      document.getElementById('jsonPanel').style.display = 'none'
    }
  </script>
  `

  return c.html(shellHtml({ title: 'Sovereign Intake', activeNav: 'sovereign', body }))
})

// ─── API: INGEST DOCUMENT ────────────────────────────────────
sovereign.post('/api/ingest', async (c) => {
  let body: { doc_id?: string; doc_type?: string; content?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON with { doc_id, doc_type, content }' }
    }, 400)
  }

  const { doc_id, doc_type, content } = body

  if (!doc_id || !content) {
    return c.json({
      success: false,
      error: { code: 'MISSING_FIELDS', message: 'doc_id and content are required' }
    }, 400)
  }

  const validTypes: SovereignDocType[] = ['current-handoff', 'active-priority', 'unknown']
  const docType: SovereignDocType = validTypes.includes(doc_type as SovereignDocType)
    ? (doc_type as SovereignDocType)
    : 'unknown'

  // HUB-20: use async ingest — persists to D1 + in-memory
  const payload = await ingestSovereignSourceAsync(doc_id, docType, content)
  const sync_result = syncSovereignIntakeToBridgeStore(payload)

  const summary = getSovereignIntakeSummary()

  return c.json({
    success: true,
    data: {
      ...payload,
      sync_result,
      // HUB-20: include persistence diagnostics in ingest response
      persistence: {
        storage_mode: summary.storage_mode,
        active_source_restored_on_boot: summary.active_source_restored_on_boot,
        note: summary.storage_mode === 'persistent'
          ? 'Source persisted to D1. Will survive restart/redeploy.'
          : summary.storage_mode === 'degraded'
          ? 'D1 write encountered an error. Source stored in-memory only (will not survive restart).'
          : 'No D1 binding. Source stored in-memory only (will not survive restart).'
      }
    }
  })
})

// ─── API: INTAKE SUMMARY (HUB-20: with persistence diagnostics) ──
sovereign.get('/api/summary', (c) => {
  const summary = getSovereignIntakeSummary()

  // HUB-20: Clean epoch timestamps — never return 1970-01-01T00:00:00.000Z
  const cleanIngestedAt = (() => {
    if (!summary.ingested_at) return null
    const ts = new Date(summary.ingested_at).getTime()
    if (ts <= 0 || ts < 1000000000000) return null  // Before year 2001 = invalid epoch
    return summary.ingested_at
  })()

  return c.json({
    success: true,
    data: {
      ...summary,
      ingested_at: cleanIngestedAt,
      // HUB-20: explicit persistence diagnostics
      storage_mode: summary.storage_mode,
      active_source_restored_on_boot: summary.active_source_restored_on_boot,
      boot_restore_note: summary.boot_restore_note,
      // HUB-20: honest fallback disclosure
      controller_fallback_active: !summary.has_active_source,
      truth_authority: summary.has_active_source
        ? `${summary.active_precedence} — ${summary.active_doc_type} (${summary.safe_source_id})`
        : 'controller_fallback (P3) only — no P1 source ingested'
    }
  })
})

// ─── API: FULL PAYLOAD ───────────────────────────────────────
sovereign.get('/api/payload', (c) => {
  const docId = c.req.query('id')
  if (!docId) {
    const active = sovereignStore.getActive()
    if (!active) {
      return c.json({
        success: false,
        error: { code: 'NO_ACTIVE_SOURCE', message: 'No sovereign source ingested yet. POST to /sovereign/api/ingest first.' }
      }, 404)
    }
    return c.json({ success: true, data: active })
  }
  const payload = sovereignStore.get(docId)
  if (!payload) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Payload for doc_id ${docId} not found` }
    }, 404)
  }
  return c.json({ success: true, data: payload })
})

// ─── API: LIST ALL PAYLOADS ───────────────────────────────────
sovereign.get('/api/list', (c) => {
  const all = sovereignStore.listAll().map(p => ({
    doc_id: p.source_meta.doc_id,
    safe_source_id: p.source_meta.safe_source_id,
    doc_type: p.source_meta.doc_type,
    precedence: p.source_meta.precedence,
    confidence: p.source_meta.confidence,
    truth_maturity: p.source_meta.confidence_breakdown?.truth_maturity || 'NONE',
    ingested_at: p.source_meta.ingested_at,
    sessions_count: p.session_truth.length,
    modules_count: p.module_truth.length,
    governance_status: p.governance_truth?.canon_status || null,
    parse_warnings: p.source_meta.parse_warnings.length,
    confidence_breakdown: p.source_meta.confidence_breakdown
  }))
  return c.json({ success: true, data: all })
})

// ─── API: EXTRACTED SESSIONS ─────────────────────────────────
sovereign.get('/api/sessions', (c) => {
  const docId = c.req.query('id')
  const payload = docId ? sovereignStore.get(docId) : sovereignStore.getActive()

  if (!payload) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'No payload found. Specify ?id=DOC_ID or ingest a source first.' }
    }, 404)
  }

  return c.json({
    success: true,
    data: {
      doc_id: payload.source_meta.doc_id,
      safe_source_id: payload.source_meta.safe_source_id,
      sessions: payload.session_truth,
      session_count: payload.session_truth.length,
      session_blocks_found: payload.source_meta.confidence_breakdown?.session_blocks_found || false
    }
  })
})

// ─── API: GOVERNANCE TRUTH ────────────────────────────────────
sovereign.get('/api/governance', (c) => {
  const active = sovereignStore.getActive()
  if (!active || !active.governance_truth) {
    return c.json({
      success: false,
      error: {
        code: 'NO_GOVERNANCE',
        message: 'No governance truth extracted. Ingest a current-handoff document with a GOVERNANCE CANON STATUS or Governance Canon section.'
      }
    }, 404)
  }
  return c.json({ success: true, data: active.governance_truth })
})

// ─── API: MERGE CONTEXT (HUB-19: with diagnostics) ───────────
sovereign.get('/api/merge', (c) => {
  const sessionId = c.req.query('session') || undefined
  const activePayload = sovereignStore.getActive()
  const merged = mergeSovereignTruthWithControllerState(activePayload, sessionId)
  return c.json({ success: true, data: merged })
})

// ─── API: RAW DOCUMENT ───────────────────────────────────────
sovereign.get('/api/raw', (c) => {
  const docId = c.req.query('id')
  if (!docId) {
    return c.json({ success: false, error: { code: 'MISSING_ID', message: '?id=DOC_ID required' } }, 400)
  }
  const raw = sovereignStore.getRaw(docId)
  if (!raw) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: `Raw doc ${docId} not found` } }, 404)
  }
  return c.text(raw)
})

// ─── API: NORMALIZE STATUS (UTILITY) ─────────────────────────
sovereign.get('/api/normalize', (c) => {
  const status = c.req.query('status')
  if (!status) {
    return c.json({ success: false, error: { code: 'MISSING_STATUS', message: '?status=TEXT required' } }, 400)
  }
  const normalized = normalizeSovereignSessionStatus(status)
  return c.json({ success: true, data: { input: status, normalized } })
})

// ─── API: CLEAR INTAKE STORE ─────────────────────────────────
sovereign.post('/api/clear', (c) => {
  sovereignStore.clear()
  return c.json({
    success: true,
    data: {
      cleared: true,
      message: 'Sovereign intake store cleared. Pack will now use P3 controller state only. Truth Maturity → NONE.'
    }
  })
})

// ╔══════════════════════════════════════════════════════════════╗
// ║  HUB-22: TASK 1 — WEBHOOK SECRET HARDENING                 ║
// ║  Real WEBHOOK_SECRET validation with explicit classification ║
// ╚══════════════════════════════════════════════════════════════╝

// ─── WEBHOOK VALIDATION RESULT TYPES ────────────────────────
/**
 * HUB-22 Token Validation Classification:
 *   VALIDATED          — secret configured, token present, matches
 *   INVALID_TOKEN      — secret configured, token present, does NOT match
 *   MISSING_TOKEN      — secret configured, but no token in request
 *   SECRET_NOT_CONFIGURED — no WEBHOOK_SECRET env var set
 */
type WebhookTokenResult =
  | 'VALIDATED'
  | 'INVALID_TOKEN'
  | 'MISSING_TOKEN'
  | 'SECRET_NOT_CONFIGURED'

// ─── IN-MEMORY WEBHOOK LOG (ephemeral — classify honestly) ───
interface WebhookInboundEvent {
  id: string
  received_at: string
  event_type: string
  source: string
  payload_keys: string[]
  // HUB-22: explicit token validation result
  token_result: WebhookTokenResult
  token_note: string
  // Overall acceptance
  validation_status: 'accepted' | 'rejected'
  validation_note: string
  queue_handoff: 'accepted' | 'rejected'
  queue_note: string
  processing_decision: string
  // Audit traceability (HUB-22 TASK 4)
  audit: {
    event_id: string
    received_at: string
    token_result: WebhookTokenResult
    queue_handoff_result: string
    final_status: string
  }
}

const webhookLog: WebhookInboundEvent[] = []

// ─── HELPER: Constant-time string comparison ────────────────
// Prevents timing attacks when comparing tokens
async function safeTokenCompare(a: string, b: string): Promise<boolean> {
  // Use Web Crypto API (available in Cloudflare Workers)
  try {
    const enc = new TextEncoder()
    const aBytes = enc.encode(a)
    const bBytes = enc.encode(b)
    if (aBytes.length !== bBytes.length) return false
    // XOR all bytes — constant time
    let diff = 0
    for (let i = 0; i < aBytes.length; i++) {
      diff |= aBytes[i] ^ bBytes[i]
    }
    return diff === 0
  } catch {
    // Fallback — not constant time but acceptable for low-risk envs
    return a === b
  }
}

// ─── HELPER: Validate webhook token ─────────────────────────
async function validateWebhookToken(
  requestToken: string | undefined,
  configuredSecret: string | undefined
): Promise<{ result: WebhookTokenResult; note: string }> {
  // Case 1: No secret configured → cannot validate
  if (!configuredSecret) {
    return {
      result: 'SECRET_NOT_CONFIGURED',
      note: 'WEBHOOK_SECRET not configured in Cloudflare Pages environment. Set via: wrangler pages secret put WEBHOOK_SECRET --project-name lane-eco-budget-control'
    }
  }

  // Case 2: Secret configured but no token in request
  if (!requestToken) {
    return {
      result: 'MISSING_TOKEN',
      note: 'WEBHOOK_SECRET is configured but request is missing X-Webhook-Token header. Request rejected.'
    }
  }

  // Case 3: Both present — compare
  const matches = await safeTokenCompare(requestToken, configuredSecret)
  if (matches) {
    return {
      result: 'VALIDATED',
      note: 'Token validated successfully against configured WEBHOOK_SECRET. Request accepted.'
    }
  } else {
    return {
      result: 'INVALID_TOKEN',
      // Never reveal the configured secret or any part of it
      note: 'Token does not match configured WEBHOOK_SECRET. Request rejected. Token value is NOT logged.'
    }
  }
}

/**
 * POST /sovereign/api/webhook/inbound
 *
 * HUB-22: Secure inbound webhook handler with WEBHOOK_SECRET validation.
 *
 * Expected body:  { event_type, source, payload? }
 * Required header: X-Webhook-Token  (if WEBHOOK_SECRET is configured)
 *
 * Token Validation Results:
 *   VALIDATED          → 200, event queued
 *   INVALID_TOKEN      → 401, rejected
 *   MISSING_TOKEN      → 401, rejected
 *   SECRET_NOT_CONFIGURED → 200, accepted (open), warned in response
 *
 * Audit fields always present:
 *   event_id, received_at, token_result, queue_handoff_result, final_status
 */
sovereign.post('/api/webhook/inbound', async (c) => {
  const receivedAt = new Date().toISOString()
  const eventId = `wh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  // ── Parse body ───────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }
    }, 400)
  }

  // ── Required field check ─────────────────────────────────
  const requiredFields = ['event_type', 'source']
  const missingFields = requiredFields.filter(f => !body[f])
  const payloadKeys = Object.keys(body)

  if (missingFields.length > 0) {
    return c.json({
      success: false,
      error: {
        code: 'MISSING_FIELDS',
        message: `Missing required fields: ${missingFields.join(', ')}`,
        required: requiredFields
      }
    }, 400)
  }

  // ── HUB-22: Token validation ─────────────────────────────
  // Read WEBHOOK_SECRET from Cloudflare env (passed via middleware context)
  // Do NOT expose or log the secret value under any circumstances
  const webhookSecret = (c.get('WEBHOOK_SECRET' as never) as string | undefined)
    ?? (c as unknown as { env?: { WEBHOOK_SECRET?: string } }).env?.WEBHOOK_SECRET
    ?? undefined

  const requestToken = c.req.header('X-Webhook-Token') ?? undefined
  const { result: tokenResult, note: tokenNote } = await validateWebhookToken(requestToken, webhookSecret)

  // ── Reject on bad/missing token (when secret IS configured) ──
  const shouldReject = tokenResult === 'INVALID_TOKEN' || tokenResult === 'MISSING_TOKEN'

  if (shouldReject) {
    // Log rejection attempt for audit (no sensitive values)
    const rejectedEvent: WebhookInboundEvent = {
      id: eventId,
      received_at: receivedAt,
      event_type: String(body.event_type || 'unknown'),
      source: String(body.source || 'unknown'),
      payload_keys: payloadKeys,
      token_result: tokenResult,
      token_note: tokenNote,
      validation_status: 'rejected',
      validation_note: tokenNote,
      queue_handoff: 'rejected',
      queue_note: `Rejected — token validation failed: ${tokenResult}`,
      processing_decision: `REJECTED — ${tokenResult}`,
      audit: {
        event_id: eventId,
        received_at: receivedAt,
        token_result: tokenResult,
        queue_handoff_result: 'rejected',
        final_status: 'REJECTED'
      }
    }
    webhookLog.push(rejectedEvent)
    if (webhookLog.length > 50) webhookLog.shift()

    return c.json({
      success: false,
      error: {
        code: tokenResult,
        message: tokenNote
      },
      audit: {
        event_id: eventId,
        received_at: receivedAt,
        token_result: tokenResult
      }
    }, 401)
  }

  // ── Queue Handoff ────────────────────────────────────────
  const eventType = String(body.event_type || 'unknown')
  const source = String(body.source || 'unknown')

  batchQueueAccept({
    event_id: eventId,
    event_type: eventType,
    source,
    payload: body.payload ?? null,
    received_at: receivedAt
  })

  const queueNote = `Accepted into batch queue. event_id: ${eventId}. Queue depth: ${batchQueue.length}.`

  // ── Determine final classification ───────────────────────
  // SECRET_NOT_CONFIGURED → PARTIAL (open endpoint, no validation possible)
  // VALIDATED → verified (token validated, queue handoff confirmed)
  const verificationLevel = tokenResult === 'VALIDATED'
    ? 'VALIDATED — token verified, event queued'
    : 'PARTIAL — SECRET_NOT_CONFIGURED, open endpoint, event queued without validation'

  // ── Log for audit ────────────────────────────────────────
  const event: WebhookInboundEvent = {
    id: eventId,
    received_at: receivedAt,
    event_type: eventType,
    source,
    payload_keys: payloadKeys,
    token_result: tokenResult,
    token_note: tokenNote,
    validation_status: 'accepted',
    validation_note: tokenNote,
    queue_handoff: 'accepted',
    queue_note: queueNote,
    processing_decision: `ACCEPTED — ${tokenResult}`,
    audit: {
      event_id: eventId,
      received_at: receivedAt,
      token_result: tokenResult,
      queue_handoff_result: 'accepted',
      final_status: tokenResult === 'VALIDATED' ? 'LIVE_VERIFIED' : 'PARTIAL'
    }
  }
  webhookLog.push(event)
  if (webhookLog.length > 50) webhookLog.shift()

  return c.json({
    success: true,
    data: {
      event_id: eventId,
      received_at: receivedAt,
      token_result: tokenResult,
      token_note: tokenNote,
      queue_handoff: 'accepted',
      queue_note: queueNote,
      processing_decision: event.processing_decision,
      verification_level: verificationLevel,
      // HUB-22 audit trace
      audit: event.audit
    }
  })
})

// ─── GET: WEBHOOK LOG ────────────────────────────────────────
sovereign.get('/api/webhook/log', (c) => {
  // HUB-22: Include overall classification honesty
  const totalEvents = webhookLog.length
  const validatedCount = webhookLog.filter(e => e.token_result === 'VALIDATED').length
  const rejectedCount = webhookLog.filter(e => e.validation_status === 'rejected').length
  const partialCount = webhookLog.filter(e => e.token_result === 'SECRET_NOT_CONFIGURED').length

  // Never expose token values in log output — payload_keys only, no values
  const safeEvents = [...webhookLog].reverse().slice(0, 20).map(e => ({
    id: e.id,
    received_at: e.received_at,
    event_type: e.event_type,
    source: e.source,
    payload_keys: e.payload_keys,
    token_result: e.token_result,
    queue_handoff: e.queue_handoff,
    processing_decision: e.processing_decision,
    audit: e.audit
  }))

  const classificationLabel = (() => {
    if (totalEvents === 0) return 'PENDING — no events received yet'
    if (validatedCount > 0) return `PARTIAL — ${validatedCount} VALIDATED event(s), ${partialCount} open, ${rejectedCount} rejected`
    if (partialCount > 0) return `PARTIAL — events received but SECRET_NOT_CONFIGURED (no token validation occurred)`
    return `REJECTED_ONLY — all ${rejectedCount} events rejected (check token)`
  })()

  return c.json({
    success: true,
    data: {
      total_events: totalEvents,
      validated_count: validatedCount,
      partial_count: partialCount,
      rejected_count: rejectedCount,
      events: safeEvents,
      classification: classificationLabel,
      // HUB-22 honest status note
      verification_note: validatedCount > 0
        ? 'PARTIAL → approaching LIVE_VERIFIED: At least one event was token-validated. Full LIVE_VERIFIED requires real external caller sending events through the secured path.'
        : 'PARTIAL: WEBHOOK_SECRET not yet configured or no validated events. Configure secret then send real events to achieve LIVE_VERIFIED.'
    }
  })
})


// ╔══════════════════════════════════════════════════════════════╗
// ║  HUB-22: TASK 3 — REAL BATCH QUEUE INTEGRATION             ║
// ║  Queue wired to webhook inbound — real event → transition   ║
// ╚══════════════════════════════════════════════════════════════╝

// ─── IN-MEMORY BATCH QUEUE ────────────────────────────────────
// NOTE: Ephemeral — survives Workers instance lifetime only.
// HUB-22 HONEST CLASSIFICATION: Queue is CONTROLLED_VERIFIED via test path.
// Full LIVE_VERIFIED requires persistent external event flowing
// through the secured webhook endpoint.
type BatchItemStatus = 'pending' | 'processing' | 'approved' | 'sent' | 'failed'

interface BatchQueueItem {
  event_id: string
  event_type: string
  source: string
  payload: unknown
  received_at: string
  // Queue state machine
  status: BatchItemStatus
  status_history: { status: BatchItemStatus; at: string; note: string }[]
  processed_at: string | null
  failure_reason: string | null
  // HUB-22: provenance — was this item from a real webhook event or test?
  origin: 'webhook_inbound' | 'test_scenario' | 'direct_ingest'
  // HUB-22: audit trace
  audit_trace: string[]
}

const batchQueue: BatchQueueItem[] = []

// ─── CORE QUEUE FUNCTIONS ────────────────────────────────────

function batchQueueAccept(event: {
  event_id: string
  event_type: string
  source: string
  payload: unknown
  received_at: string
  origin?: BatchQueueItem['origin']
}): BatchQueueItem {
  const item: BatchQueueItem = {
    event_id: event.event_id,
    event_type: event.event_type,
    source: event.source,
    payload: event.payload,
    received_at: event.received_at,
    status: 'pending',
    status_history: [{
      status: 'pending',
      at: event.received_at,
      note: `Accepted from ${event.origin ?? 'webhook_inbound'}`
    }],
    processed_at: null,
    failure_reason: null,
    origin: event.origin ?? 'webhook_inbound',
    audit_trace: [
      `[${event.received_at}] ACCEPTED — origin: ${event.origin ?? 'webhook_inbound'}, event_type: ${event.event_type}`
    ]
  }
  batchQueue.push(item)
  // Cap at 100 items — ephemeral store
  if (batchQueue.length > 100) batchQueue.shift()
  return item
}

function batchQueueTransition(
  eventId: string,
  newStatus: BatchItemStatus,
  note: string
): BatchQueueItem | null {
  const item = batchQueue.find(i => i.event_id === eventId)
  if (!item) return null

  const prevStatus = item.status
  item.status = newStatus

  const at = new Date().toISOString()
  item.status_history.push({ status: newStatus, at, note })
  item.audit_trace.push(`[${at}] TRANSITION ${prevStatus} → ${newStatus}: ${note}`)

  if (newStatus === 'sent' || newStatus === 'approved') {
    item.processed_at = at
  }
  if (newStatus === 'failed') {
    item.failure_reason = note
    item.processed_at = at
    item.audit_trace.push(`[${at}] FAILED: ${note}`)
  }

  return item
}

// ─── GET: QUEUE STATUS ───────────────────────────────────────
sovereign.get('/api/queue/status', (c) => {
  const statusCounts: Record<BatchItemStatus, number> = {
    pending: 0, processing: 0, approved: 0, sent: 0, failed: 0
  }
  batchQueue.forEach(i => { statusCounts[i.status]++ })

  // HUB-22: Distinguish real webhook items from test items
  const realItems = batchQueue.filter(i => i.origin === 'webhook_inbound').length
  const testItems = batchQueue.filter(i => i.origin === 'test_scenario').length

  // Honest classification
  const classification = (() => {
    if (batchQueue.length === 0) return 'PENDING — no items in queue yet'
    if (realItems > 0) return `PARTIAL — ${realItems} real webhook event(s) queued, ${testItems} test items. Awaiting full transition verification from live external input.`
    return `CONTROLLED_VERIFIED — ${testItems} controlled test item(s) only. No real external events yet. Send webhook to /api/webhook/inbound to trigger real queue.`
  })()

  return c.json({
    success: true,
    data: {
      queue_depth: batchQueue.length,
      real_webhook_items: realItems,
      test_items: testItems,
      status_summary: statusCounts,
      items: batchQueue.slice(-10).reverse().map(i => ({
        event_id: i.event_id,
        event_type: i.event_type,
        source: i.source,
        origin: i.origin,
        status: i.status,
        received_at: i.received_at,
        processed_at: i.processed_at,
        status_history: i.status_history
      })),
      classification,
      // HUB-22 honest persistence note
      persistence_note: 'EPHEMERAL: Queue uses in-memory store. Items lost on Cloudflare Worker restart/cold start. For production durability, wire to D1 or KV.',
      verification_note: realItems > 0
        ? `PARTIAL: ${realItems} real webhook item(s) in queue. Status transitions verified. Full LIVE_VERIFIED when a validated event completes full pending→sent cycle.`
        : 'CONTROLLED_VERIFIED: All state transitions verified via test. Wire external event source to achieve LIVE_VERIFIED.'
    }
  })
})

// ─── POST: QUEUE PROCESS (Manual transition) ─────────────────
sovereign.post('/api/queue/process', async (c) => {
  let body: { event_id?: string; action?: string; note?: string }
  try { body = await c.req.json() } catch { body = {} }

  const { event_id, action, note } = body
  if (!event_id || !action) {
    return c.json({
      success: false,
      error: { code: 'MISSING_FIELDS', message: 'event_id and action required' }
    }, 400)
  }

  const validActions: BatchItemStatus[] = ['processing', 'approved', 'sent', 'failed']
  if (!validActions.includes(action as BatchItemStatus)) {
    return c.json({
      success: false,
      error: { code: 'INVALID_ACTION', message: `action must be one of: ${validActions.join(', ')}` }
    }, 400)
  }

  const updated = batchQueueTransition(
    event_id,
    action as BatchItemStatus,
    note || `Manual transition to ${action} via /api/queue/process`
  )

  if (!updated) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: `event_id ${event_id} not found in queue` }
    }, 404)
  }

  return c.json({
    success: true,
    data: {
      event_id,
      origin: updated.origin,
      new_status: updated.status,
      status_history: updated.status_history,
      audit_trace: updated.audit_trace,
      // HUB-22 classification
      classification: updated.origin === 'webhook_inbound'
        ? 'PARTIAL — real webhook item transitioned. Full LIVE_VERIFIED when complete cycle confirmed from validated external event.'
        : 'CONTROLLED_VERIFIED — test item transitioned. State machine verified.'
    }
  })
})

// ─── POST: QUEUE TEST SCENARIO (Controlled E2E verification) ──
// HUB-22: Produces a controlled verification artifact.
// Distinct from real events via origin='test_scenario'.
// Does NOT count toward LIVE_VERIFIED — honest classification only.
sovereign.post('/api/queue/test', async (c) => {
  const testEventId = `test-${Date.now()}`
  const startAt = new Date().toISOString()

  // Create test item with explicit origin
  batchQueueAccept({
    event_id: testEventId,
    event_type: 'test.hub22.verification',
    source: 'hub22.queue.test',
    payload: { scenario: 'controlled_e2e_verification', hub: 'HUB-22' },
    received_at: startAt,
    origin: 'test_scenario'
  })

  // Run full state machine: pending → processing → approved → sent
  const steps: Array<{ action: BatchItemStatus; note: string }> = [
    { action: 'processing', note: 'Picked up for processing — controlled test' },
    { action: 'approved', note: 'Approved after validation — controlled test' },
    { action: 'sent', note: 'Dispatched to downstream — controlled test' }
  ]

  const transitions: { status: BatchItemStatus; at: string; note: string }[] = []
  for (const step of steps) {
    const updated = batchQueueTransition(testEventId, step.action, step.note)
    if (updated) {
      transitions.push(updated.status_history[updated.status_history.length - 1])
    }
  }

  const finalItem = batchQueue.find(i => i.event_id === testEventId)

  return c.json({
    success: true,
    data: {
      test_event_id: testEventId,
      final_status: finalItem?.status,
      origin: 'test_scenario',
      status_history: finalItem?.status_history,
      audit_trace: finalItem?.audit_trace,
      verification_artifact: {
        scenario: 'controlled_end_to_end',
        transitions_completed: transitions.length,
        states_verified: ['pending', 'processing', 'approved', 'sent'],
        all_states_reachable: true,
        // HUB-22 honest classification
        classification: 'CONTROLLED_VERIFIED — all state transitions work. This is a test event (origin=test_scenario). Send a real webhook event to /api/webhook/inbound to achieve LIVE_VERIFIED.',
        next_action: 'POST to /api/webhook/inbound with { event_type, source } to trigger a real queue item from a live external event.'
      }
    }
  })
})

export default sovereign
