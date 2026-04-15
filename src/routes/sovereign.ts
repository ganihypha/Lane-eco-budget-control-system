// ============================================================
// SOVEREIGN SOURCE INTAKE ROUTE — Lane-Eco Budget Control System
// SESSION HUB-19: Truth-Maturity Upgrade
//
// Routes:
//   GET  /sovereign                   → Sovereign Intake UI (with truth-maturity badges)
//   POST /sovereign/api/ingest        → Ingest raw markdown doc
//   GET  /sovereign/api/summary       → Intake summary + status
//   GET  /sovereign/api/payload?id=X  → Full normalized payload
//   GET  /sovereign/api/sessions?id=X → Extracted session truth
//   GET  /sovereign/api/governance    → Governance truth
//   GET  /sovereign/api/merge?session=X → Merged truth context with diagnostics
//   POST /sovereign/api/clear         → Clear intake store (reset)
//
// HUB-19 UI Additions:
//   F1. Truth maturity badge (NONE/LOW/MEDIUM/HIGH)
//   F2. Extraction completeness summary
//   F3. Merge diagnostics panel
//   F4. Safe source label (doc_id + type only)
//   F5. Compact actionable warnings
// ============================================================

import { Hono } from 'hono'
import { shellHtml } from '../lib/ui'
import {
  ingestSovereignSource,
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

  const body = `
  <div class="p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div>
        <div class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Sovereign Source Intake — HUB-19</div>
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

  const payload = ingestSovereignSource(doc_id, docType, content)
  const sync_result = syncSovereignIntakeToBridgeStore(payload)

  return c.json({
    success: true,
    data: { ...payload, sync_result }
  })
})

// ─── API: INTAKE SUMMARY ─────────────────────────────────────
sovereign.get('/api/summary', (c) => {
  const summary = getSovereignIntakeSummary()
  return c.json({ success: true, data: summary })
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

export default sovereign
