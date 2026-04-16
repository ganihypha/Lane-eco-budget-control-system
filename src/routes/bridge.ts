// ============================================================
// PROMPT BRIDGE ROUTE — Lane-Eco Budget Control System
// UI Page + API Endpoints for Prompt Bridge
//
// Spec: Prompt Bridge Doc v1.0 + Master Architect Full Final
// Purpose: Generate Master Architect Context Pack from live
//          operational truth. Ingest closeout from AI Dev runs.
//
// Routes:
//   GET  /bridge            → Prompt Bridge UI (session picker + pack generator)
//   POST /bridge/generate   → Generate Master Architect Pack for session
//   POST /bridge/ingest     → Ingest execution closeout
//   GET  /bridge/api/pack   → JSON API: generate pack
//   GET  /bridge/api/repo   → JSON API: repo authority context
//   GET  /bridge/api/ecosystem → JSON API: ecosystem context
// ============================================================

import { Hono } from 'hono'
import { shellHtml } from '../lib/ui'
import { store } from '../lib/store'
import {
  generateMasterArchitectPack,
  exportSessionPromptContext,
  exportLanePromptContext,
  exportEcosystemPromptContext,
  exportDecisionSummary,
  exportRepoAuthorityContext,
  ingestExecutionCloseout
} from '../lib/bridge'
import { getSovereignIntakeSummary } from '../lib/sovereign'
import type { EntityType, DecisionType } from '../lib/types'

const bridge = new Hono()

// ─── HELPER: Decision type colors ────────────────────────────
const decisionColors: Record<string, string> = {
  go: '#22c55e', stop: '#ef4444', freeze: '#60a5fa',
  split: '#f59e0b', continue: '#22c55e', escalate: '#ef4444',
  defer: '#94a3b8', close: '#64748b'
}

// ─── UI: MAIN PROMPT BRIDGE PAGE ─────────────────────────────
bridge.get('/', (c) => {
  const sessions = store.listSessions()
  const activeSessions = sessions.filter(s => !['done', 'cancelled', 'frozen'].includes(s.status))
  const eco = exportEcosystemPromptContext()
  const repo = exportRepoAuthorityContext()
  const sovereign = getSovereignIntakeSummary()

  // Session options for dropdown
  const sessionOptions = sessions.map(s => {
    const isActive = !['done', 'cancelled', 'frozen'].includes(s.status)
    return `<option value="${s.id}" ${isActive ? '' : 'style="color:#64748b"'}>${s.id} — ${s.title} [${s.status.toUpperCase()}]</option>`
  }).join('')

  // Signal color map
  const signalColor: Record<string, string> = { GO: '#22c55e', WATCH: '#f59e0b', STOP: '#ef4444' }

  // Active sessions summary cards
  const activeCards = activeSessions.map(s => {
    const computed = store.getSession(s.id)!
    const sigColor = signalColor[computed.go_stop_signal] || '#94a3b8'
    return `
    <div class="card p-4 cursor-pointer hover:border-blue-500 transition-all" onclick="selectSession('${s.id}')" style="border-color:#334155">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-bold text-slate-400">${s.id}</span>
        <span style="color:${sigColor};font-size:0.7rem;font-weight:700;background:rgba(0,0,0,0.3);padding:2px 8px;border-radius:4px">${computed.go_stop_signal}</span>
      </div>
      <div class="font-semibold text-white text-sm mb-1">${s.title}</div>
      <div class="text-xs text-slate-500">${computed.lane_name || 'No Lane'} · ${computed.actual_budget_unit}/${computed.hard_cap_budget_unit} BU · ${s.status}</div>
    </div>`
  }).join('')

  const body = `
  <div class="p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <div class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Sovereign-Grounded Prompt Gateway</div>
        <h1 class="text-2xl font-bold text-white">Master Architect Context Pack Generator</h1>
        <p class="text-sm text-slate-400 mt-1">Export sovereign-grounded, truth-mature context packs for Master Architect / downstream AI executor sessions.</p>
      </div>
      <div class="text-right">
        <div class="text-xs text-slate-500 mb-1">Ecosystem Status</div>
        <div class="text-sm font-semibold" style="color:${eco.pressure_level === 'critical' ? '#ef4444' : eco.pressure_level === 'high' ? '#f59e0b' : '#22c55e'}">${eco.ecosystem_health.toUpperCase()} · ${eco.pressure_pct}% pressure</div>
        <div class="text-xs text-slate-600 mt-1">${eco.budget_remaining} BU remaining</div>
      </div>
    </div>

    <!-- Sovereign Source Status Banner (HUB-19: truth maturity badge) -->
    ${(() => {
      const maturity = sovereign.truth_maturity || 'NONE'
      const maturityColorMap: Record<string, string> = { HIGH: '#22c55e', MEDIUM: '#f59e0b', LOW: '#ef4444', NONE: '#475569' }
      const maturityBgMap: Record<string, string> = { HIGH: 'rgba(34,197,94,0.08)', MEDIUM: 'rgba(245,158,11,0.08)', LOW: 'rgba(239,68,68,0.08)', NONE: 'rgba(71,85,105,0.08)' }
      const mColor = maturityColorMap[maturity] || '#475569'
      const mBg = maturityBgMap[maturity] || 'rgba(71,85,105,0.08)'
      const confColor = sovereign.confidence === 'high' ? '#22c55e' : sovereign.confidence === 'medium' ? '#f59e0b' : '#ef4444'
      const safeId = sovereign.safe_source_id || sovereign.active_doc_id
      const bd = sovereign.confidence_breakdown
      return `
    <div class="card p-4 mb-4" style="border-color:${mColor}40;background:${mBg}">
      <div class="flex items-center justify-between">
        <div class="flex items-start gap-3">
          <i class="fas fa-layer-group mt-0.5" style="color:${mColor}"></i>
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-semibold" style="color:${sovereign.has_active_source ? '#a78bfa' : '#94a3b8'}">
                Sovereign Source: ${sovereign.has_active_source ? safeId + ' (' + sovereign.active_precedence + ' — ' + sovereign.active_doc_type + ')' : 'NOT LOADED'}
              </span>
              <span class="text-xs font-bold px-2 py-0.5 rounded" style="background:${mBg};color:${mColor};border:1px solid ${mColor}40">
                ${maturity}
              </span>
            </div>
            <div class="text-xs text-slate-400">
              ${sovereign.has_active_source
                ? `Confidence: <span style="color:${confColor};font-weight:600">${sovereign.confidence?.toUpperCase()}</span>` +
                  ` · Sessions: ${sovereign.sessions_extracted}` +
                  ` · Governance: ${sovereign.governance_status}${sovereign.governance_status === 'frozen' ? ' 🔒' : ''}` +
                  (bd ? ` · Score: ${bd.dimensions_met}/${bd.total_dimensions}` : '') +
                  ` · Pack: canonical truth grounded`
                : 'Pack grounded on P3 controller state only. Truth Maturity: NONE. <a href="/sovereign" style="color:#a78bfa">Ingest current-handoff →</a>'}
            </div>
          </div>
        </div>
        <a href="/sovereign" class="btn-secondary text-xs py-1 px-3 flex-shrink-0">
          <i class="fas fa-upload mr-1"></i>${sovereign.has_active_source ? 'Update Source' : 'Ingest Source'}
        </a>
      </div>
    </div>`
    })()}

    <!-- Platform Identity + Architecture Banner -->
    <div class="card p-4 mb-6" style="border-color:#1d4ed8;background:rgba(29,78,216,0.08)">
      <div class="flex items-start gap-3">
        <i class="fas fa-diagram-project text-blue-400 mt-0.5"></i>
        <div class="w-full">
          <div class="flex items-center gap-2 mb-2">
            <div class="text-sm font-semibold text-blue-300">Sovereign-Grounded Operational Prompt Gateway</div>
            <span class="text-xs px-2 py-0.5 rounded" style="background:rgba(139,92,246,0.15);color:#a78bfa;border:1px solid rgba(139,92,246,0.3)">v1.6.0 / hub24</span>
          </div>
          <div class="text-xs text-slate-400 mb-2">
            <span class="text-violet-400 font-semibold">[1] Sovereign Intake</span>
            <span class="text-slate-600 mx-1 text-xs">canonical truth ingress</span>
            <span class="text-slate-600 mx-2">→</span>
            <span class="text-white">[2] Budget Controller</span>
            <span class="text-slate-600 mx-1 text-xs">operational surface</span>
            <span class="text-slate-600 mx-2">→</span>
            <span class="text-blue-300 font-semibold">[3] Prompt Bridge</span>
            <span class="text-slate-600 mx-1 text-xs">gateway layer</span>
            <span class="text-slate-600 mx-2">→</span>
            <span class="text-white">[4] Master Architect / AI Dev</span>
            <span class="text-slate-600 mx-1 text-xs">execution consumer</span>
          </div>
          <div class="text-xs text-slate-500">This is not a generic dashboard. It is a sovereign-grounded prompt gateway where P1 current-handoff is the canonical truth authority.</div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6" style="grid-template-columns: 1fr 1fr">

      <!-- LEFT: Pack Generator -->
      <div>
        <div class="card p-5 mb-4">
          <h2 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <i class="fas fa-file-export text-blue-400"></i>
            Generate Master Architect Context Pack
          </h2>

          <!-- Session selector -->
          <div class="mb-4">
            <label class="form-label">Target Session</label>
            <select id="sessionSelect" onchange="selectSession(this.value)" style="background:#0f172a;border:1px solid #475569;color:#e2e8f0;border-radius:0.5rem;padding:0.5rem 0.75rem;width:100%">
              <option value="">— Auto-detect active session —</option>
              ${sessionOptions}
            </select>
          </div>

          <!-- Quick select active sessions -->
          ${activeSessions.length > 0 ? `
          <div class="mb-4">
            <label class="form-label">Quick Select Active Session</label>
            <div class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))">
              ${activeCards}
            </div>
          </div>` : ''}

          <!-- Generate button -->
          <button onclick="generatePack()" class="btn-primary w-full flex items-center justify-center gap-2">
            <i class="fas fa-wand-magic-sparkles"></i>
            Generate Context Pack
          </button>
        </div>

        <!-- API Endpoints Reference -->
        <div class="card p-5">
          <h2 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <i class="fas fa-code text-green-400"></i>
            API Endpoints
          </h2>
          <div class="space-y-2 text-xs font-mono">
            <div class="flex items-center gap-2">
              <span style="color:#22c55e;font-weight:700">GET</span>
              <span class="text-slate-300">/bridge/api/pack?session=SESSION_ID</span>
            </div>
            <div class="flex items-center gap-2">
              <span style="color:#22c55e;font-weight:700">GET</span>
              <span class="text-slate-300">/bridge/api/ecosystem</span>
            </div>
            <div class="flex items-center gap-2">
              <span style="color:#22c55e;font-weight:700">GET</span>
              <span class="text-slate-300">/bridge/api/repo</span>
            </div>
            <div class="flex items-center gap-2">
              <span style="color:#22c55e;font-weight:700">GET</span>
              <span class="text-slate-300">/bridge/api/session?id=SESSION_ID</span>
            </div>
            <div class="flex items-center gap-2">
              <span style="color:#22c55e;font-weight:700">GET</span>
              <span class="text-slate-300">/bridge/api/lane?id=LANE_ID</span>
            </div>
            <div class="flex items-center gap-2">
              <span style="color:#f59e0b;font-weight:700">POST</span>
              <span class="text-slate-300">/bridge/ingest</span>
              <span style="color:#64748b">(closeout)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT: Closeout Ingestor -->
      <div>
        <div class="card p-5 mb-4">
          <h2 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <i class="fas fa-download text-amber-400"></i>
            Ingest Execution Closeout
          </h2>
          <p class="text-xs text-slate-400 mb-4">After AI Dev completes work, use this form to write results back into the controller and close the loop.</p>

          <form action="/bridge/ingest" method="POST" class="space-y-3">
            <div>
              <label class="form-label">Session ID *</label>
              <input type="text" name="session_id" placeholder="HUB-16" required/>
            </div>
            <div class="grid gap-3" style="grid-template-columns:1fr 1fr">
              <div>
                <label class="form-label">Final Status *</label>
                <select name="final_status" required style="background:#0f172a;border:1px solid #475569;color:#e2e8f0;border-radius:0.5rem;padding:0.5rem 0.75rem;width:100%">
                  <option value="done">Done</option>
                  <option value="partial">Partial</option>
                  <option value="blocked">Blocked</option>
                  <option value="frozen">Frozen</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label class="form-label">Actual Burn (BU) *</label>
                <input type="number" name="actual_budget_unit" min="0" placeholder="e.g. 4" required/>
              </div>
            </div>
            <div>
              <label class="form-label">Actual Output *</label>
              <textarea name="actual_output" rows="2" placeholder="What was actually produced / delivered?" required style="background:#0f172a;border:1px solid #475569;color:#e2e8f0;border-radius:0.5rem;padding:0.5rem 0.75rem;width:100%;resize:vertical"></textarea>
            </div>
            <div class="grid gap-3" style="grid-template-columns:1fr 1fr">
              <div>
                <label class="form-label">Decision Type *</label>
                <select name="decision_type" required style="background:#0f172a;border:1px solid #475569;color:#e2e8f0;border-radius:0.5rem;padding:0.5rem 0.75rem;width:100%">
                  <option value="go">GO</option>
                  <option value="stop">STOP</option>
                  <option value="continue">CONTINUE</option>
                  <option value="split">SPLIT SESSION</option>
                  <option value="freeze">FREEZE</option>
                  <option value="escalate">ESCALATE</option>
                  <option value="defer">DEFER</option>
                  <option value="close">CLOSE</option>
                </select>
              </div>
              <div>
                <label class="form-label">Blocker Type</label>
                <select name="blocker_type" style="background:#0f172a;border:1px solid #475569;color:#e2e8f0;border-radius:0.5rem;padding:0.5rem 0.75rem;width:100%">
                  <option value="none">None</option>
                  <option value="credential">Credential</option>
                  <option value="external_access">External Access</option>
                  <option value="technical">Technical</option>
                  <option value="strategic">Strategic</option>
                  <option value="dependency">Dependency</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
            </div>
            <div>
              <label class="form-label">Decision Reason *</label>
              <input type="text" name="decision_reason" placeholder="Why was this decision made?" required/>
            </div>
            <div>
              <label class="form-label">Next Locked Move</label>
              <input type="text" name="next_locked_move" placeholder="What is the next concrete step?"/>
            </div>
            <div>
              <label class="form-label">Evidence Links (comma-separated)</label>
              <input type="text" name="evidence_links" placeholder="https://github.com/..., https://..."/>
            </div>
            <div>
              <label class="form-label">Blocker Note</label>
              <input type="text" name="blocker_note" placeholder="Describe the blocker if any"/>
            </div>
            <div>
              <label class="form-label">Submitted By</label>
              <input type="text" name="created_by" value="Founder" placeholder="Founder"/>
            </div>
            <button type="submit" class="btn-primary w-full flex items-center justify-center gap-2">
              <i class="fas fa-circle-arrow-down"></i>
              Ingest Closeout
            </button>
          </form>
        </div>

        <!-- Repo + Ecosystem Truth Card -->
        <div class="card p-5">
          <h2 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <i class="fas fa-server text-slate-400"></i>
            Repo &amp; Ecosystem Snapshot
          </h2>
          <div class="space-y-2 text-xs">
            <div class="flex justify-between">
              <span class="text-slate-500">Canonical Product Repo</span>
              <a href="https://github.com/ganihypha/Lane-eco-budget-control-system" target="_blank" class="text-blue-400 hover:text-blue-300 truncate ml-2">ganihypha/Lane-eco-budget-control-system</a>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Live URL</span>
              <a href="https://lane-eco-budget-control.pages.dev/" target="_blank" class="text-blue-400 hover:text-blue-300">lane-eco-budget-control.pages.dev</a>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Execution Status</span>
              <span class="text-green-400 font-semibold">LIVE-VERIFIED</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Ecosystem Period</span>
              <span class="text-white">${eco.period_label}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Budget Remaining</span>
              <span class="text-white">${eco.budget_remaining} / ${eco.total_budget_cap} BU</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Pressure Level</span>
              <span style="color:${eco.pressure_level === 'critical' ? '#ef4444' : eco.pressure_level === 'high' ? '#f59e0b' : '#22c55e'}">${eco.pressure_level.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Output Area -->
    <div id="outputArea" class="mt-6" style="display:none">
      <div class="card p-0 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3" style="background:#0f172a;border-bottom:1px solid #334155">
          <div class="flex items-center gap-2">
            <i class="fas fa-file-code text-blue-400"></i>
            <span class="text-sm font-bold text-white">Master Architect Context Pack</span>
            <span id="packSessionLabel" class="text-xs text-slate-500"></span>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="copyPack()" class="btn-secondary text-xs py-1 px-3">
              <i class="fas fa-copy mr-1"></i>Copy Pack
            </button>
            <button onclick="downloadPack()" class="btn-secondary text-xs py-1 px-3">
              <i class="fas fa-download mr-1"></i>Download .txt
            </button>
          </div>
        </div>
        <pre id="packOutput" class="p-5 text-xs text-slate-300 overflow-x-auto scrollbar-thin" style="white-space:pre-wrap;max-height:600px;overflow-y:auto;font-family:monospace;background:#0a0f1a;line-height:1.6"></pre>
      </div>

      <!-- Structured JSON view toggle -->
      <div class="mt-4 card p-0 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3" style="background:#0f172a;border-bottom:1px solid #334155">
          <div class="flex items-center gap-2">
            <i class="fas fa-brackets-curly text-amber-400"></i>
            <span class="text-sm font-bold text-white">Structured JSON</span>
          </div>
          <button onclick="toggleJson()" class="btn-secondary text-xs py-1 px-3" id="jsonToggleBtn">
            <i class="fas fa-eye mr-1"></i>Show JSON
          </button>
        </div>
        <pre id="jsonOutput" class="p-5 text-xs text-slate-300 overflow-x-auto scrollbar-thin" style="display:none;white-space:pre-wrap;max-height:400px;overflow-y:auto;font-family:monospace;background:#0a0f1a;line-height:1.6"></pre>
      </div>
    </div>
  </div>

  <script>
    let currentPackData = null;
    let selectedSessionId = '';

    function selectSession(id) {
      selectedSessionId = id;
      document.getElementById('sessionSelect').value = id;
    }

    async function generatePack() {
      const sessionId = selectedSessionId || document.getElementById('sessionSelect').value;
      const url = '/bridge/api/pack' + (sessionId ? '?session=' + encodeURIComponent(sessionId) : '');

      // Show loading state
      document.getElementById('outputArea').style.display = 'block';
      document.getElementById('packOutput').textContent = 'Generating context pack...';
      document.getElementById('packSessionLabel').textContent = '';

      try {
        const resp = await fetch(url);
        const data = await resp.json();
        currentPackData = data;

        if (data.success && data.data) {
          const pack = data.data;
          document.getElementById('packOutput').textContent = pack.text_pack;
          document.getElementById('packSessionLabel').textContent = '— Session: ' + pack.build_session;
          document.getElementById('jsonOutput').textContent = JSON.stringify(pack, null, 2);

          // Scroll to output
          document.getElementById('outputArea').scrollIntoView({ behavior: 'smooth' });
        } else {
          document.getElementById('packOutput').textContent = 'Error: ' + (data.error?.message || 'Unknown error');
        }
      } catch (err) {
        document.getElementById('packOutput').textContent = 'Error generating pack: ' + err.message;
      }
    }

    function copyPack() {
      const text = document.getElementById('packOutput').textContent;
      navigator.clipboard.writeText(text).then(() => {
        const btn = event.target.closest('button');
        btn.innerHTML = '<i class="fas fa-check mr-1"></i>Copied!';
        setTimeout(() => btn.innerHTML = '<i class="fas fa-copy mr-1"></i>Copy Pack', 2000);
      });
    }

    function downloadPack() {
      const text = document.getElementById('packOutput').textContent;
      const sessionId = (currentPackData?.data?.build_session || 'pack').replace(/[^a-z0-9_-]/gi, '-');
      const blob = new Blob([text], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'master-architect-context-' + sessionId + '-' + new Date().toISOString().split('T')[0] + '.txt';
      a.click();
    }

    function toggleJson() {
      const el = document.getElementById('jsonOutput');
      const btn = document.getElementById('jsonToggleBtn');
      if (el.style.display === 'none') {
        el.style.display = 'block';
        btn.innerHTML = '<i class="fas fa-eye-slash mr-1"></i>Hide JSON';
      } else {
        el.style.display = 'none';
        btn.innerHTML = '<i class="fas fa-eye mr-1"></i>Show JSON';
      }
    }
  </script>
  `

  return c.html(shellHtml({ title: 'Prompt Bridge', activeNav: 'bridge', body }))
})

// ─── POST: GENERATE PACK (Form) ───────────────────────────────
bridge.post('/generate', async (c) => {
  const form = await c.req.formData()
  const sessionId = form.get('session_id') as string | undefined
  const pack = generateMasterArchitectPack(sessionId || undefined)
  const body = renderPackResultPage(pack)
  return c.html(shellHtml({ title: 'Context Pack Generated', activeNav: 'bridge', body }))
})

function renderPackResultPage(pack: ReturnType<typeof generateMasterArchitectPack>): string {
  return `
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <div class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Prompt Bridge → Result</div>
        <h1 class="text-2xl font-bold text-white">Context Pack Generated</h1>
        <p class="text-xs text-slate-500 mt-1">Session: ${pack.build_session} · Generated: ${new Date(pack.generated_at).toLocaleString()}</p>
      </div>
      <a href="/bridge" class="btn-secondary text-sm">
        <i class="fas fa-arrow-left mr-1"></i>Back to Bridge
      </a>
    </div>
    <div class="card p-0 overflow-hidden">
      <div class="px-5 py-3 flex items-center justify-between" style="background:#0f172a;border-bottom:1px solid #334155">
        <div class="flex items-center gap-2">
          <i class="fas fa-file-code text-blue-400"></i>
          <span class="text-sm font-bold text-white">Master Architect Context Pack</span>
        </div>
      </div>
      <pre class="p-5 text-xs text-slate-300 overflow-x-auto" style="white-space:pre-wrap;font-family:monospace;background:#0a0f1a;line-height:1.6">${escapeHtml(pack.text_pack)}</pre>
    </div>
  </div>`
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ─── POST: INGEST CLOSEOUT ────────────────────────────────────
bridge.post('/ingest', async (c) => {
  const form = await c.req.formData()

  const evidenceRaw = (form.get('evidence_links') as string) || ''
  const evidenceLinks = evidenceRaw.split(',').map(l => l.trim()).filter(Boolean)

  const result = ingestExecutionCloseout({
    session_id: (form.get('session_id') as string) || '',
    final_status: (form.get('final_status') as string) || 'done',
    actual_output: (form.get('actual_output') as string) || '',
    actual_budget_unit: Number(form.get('actual_budget_unit')) || 0,
    blocker_type: (form.get('blocker_type') as string) || 'none',
    blocker_note: (form.get('blocker_note') as string) || '',
    decision_type: ((form.get('decision_type') as string) || 'continue') as DecisionType,
    decision_reason: (form.get('decision_reason') as string) || '',
    next_locked_move: (form.get('next_locked_move') as string) || '',
    evidence_links: evidenceLinks,
    created_by: (form.get('created_by') as string) || 'Founder'
  })

  const statusColor = result.success ? '#22c55e' : '#ef4444'
  const body = `
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <div class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Prompt Bridge → Closeout</div>
        <h1 class="text-2xl font-bold text-white">Closeout Ingestion ${result.success ? 'Complete' : 'Failed'}</h1>
      </div>
      <a href="/bridge" class="btn-secondary text-sm">
        <i class="fas fa-arrow-left mr-1"></i>Back to Bridge
      </a>
    </div>

    <div class="card p-6 mb-4" style="border-color:${statusColor}40">
      <div class="flex items-center gap-3 mb-4">
        <div style="width:40px;height:40px;border-radius:50%;background:${statusColor}20;display:flex;align-items:center;justify-content:center">
          <i class="fas ${result.success ? 'fa-check' : 'fa-times'}" style="color:${statusColor}"></i>
        </div>
        <div>
          <div class="font-bold text-white">${result.message}</div>
          <div class="text-xs text-slate-500 mt-0.5">Session ID: ${result.session_id}</div>
        </div>
      </div>
      <div class="grid gap-3 text-sm" style="grid-template-columns:1fr 1fr">
        <div class="flex justify-between">
          <span class="text-slate-400">Session Updated</span>
          <span style="color:${result.session_updated ? '#22c55e' : '#ef4444'}">${result.session_updated ? '✅ Yes' : '❌ No'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">Decision Logged</span>
          <span style="color:${result.decision_logged ? '#22c55e' : '#ef4444'}">${result.decision_logged ? '✅ Yes' : '❌ No'}</span>
        </div>
        ${result.decision_id ? `
        <div class="flex justify-between">
          <span class="text-slate-400">Decision ID</span>
          <span class="text-white">${result.decision_id}</span>
        </div>` : ''}
      </div>
    </div>

    ${result.success ? `
    <div class="flex gap-3">
      <a href="/sessions/${result.session_id}" class="btn-secondary text-sm">
        <i class="fas fa-eye mr-1"></i>View Session
      </a>
      <a href="/decisions" class="btn-secondary text-sm">
        <i class="fas fa-book-open mr-1"></i>View Decisions
      </a>
      <a href="/bridge" class="btn-primary text-sm">
        <i class="fas fa-wand-magic-sparkles mr-1"></i>Generate Next Pack
      </a>
    </div>` : `
    <a href="/bridge" class="btn-secondary text-sm">
      <i class="fas fa-arrow-left mr-1"></i>Try Again
    </a>`}
  </div>`

  return c.html(shellHtml({ title: 'Closeout Ingested', activeNav: 'bridge', body }))
})

// ─── API: GENERATE PACK (JSON) ────────────────────────────────
bridge.get('/api/pack', (c) => {
  const sessionId = c.req.query('session') || undefined
  const pack = generateMasterArchitectPack(sessionId)
  return c.json({ success: true, data: pack })
})

// ─── API: ECOSYSTEM CONTEXT (JSON) ───────────────────────────
bridge.get('/api/ecosystem', (c) => {
  const eco = exportEcosystemPromptContext()
  return c.json({ success: true, data: eco })
})

// ─── API: REPO AUTHORITY (JSON) ──────────────────────────────
bridge.get('/api/repo', (c) => {
  const repo = exportRepoAuthorityContext()
  return c.json({ success: true, data: repo })
})

// ─── API: SESSION CONTEXT (JSON) ─────────────────────────────
bridge.get('/api/session', (c) => {
  const sessionId = c.req.query('id')
  if (!sessionId) {
    return c.json({ success: false, error: { code: 'MISSING_ID', message: 'session id required: ?id=SESSION_ID' } }, 400)
  }
  const ctx = exportSessionPromptContext(sessionId)
  if (!ctx) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: `Session ${sessionId} not found` } }, 404)
  }
  return c.json({ success: true, data: ctx })
})

// ─── API: LANE CONTEXT (JSON) ────────────────────────────────
bridge.get('/api/lane', (c) => {
  const laneId = c.req.query('id')
  if (!laneId) {
    return c.json({ success: false, error: { code: 'MISSING_ID', message: 'lane id required: ?id=LANE_ID' } }, 400)
  }
  const ctx = exportLanePromptContext(laneId)
  if (!ctx) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: `Lane ${laneId} not found` } }, 404)
  }
  return c.json({ success: true, data: ctx })
})

// ─── API: DECISION SUMMARY (JSON) ────────────────────────────
bridge.get('/api/decisions', (c) => {
  const entityType = (c.req.query('type') || 'session') as EntityType
  const entityId = c.req.query('id') || ''
  const ctx = exportDecisionSummary(entityType, entityId)
  return c.json({ success: true, data: ctx })
})

// ─── API: INGEST CLOSEOUT (JSON) ─────────────────────────────
bridge.post('/api/ingest', async (c) => {
  const payload = await c.req.json()
  const result = ingestExecutionCloseout(payload)
  return c.json({ success: result.success, data: result })
})

export default bridge
