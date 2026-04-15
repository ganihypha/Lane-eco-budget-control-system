// ============================================================
// DASHBOARD ROUTE — Lane-Eco Budget Control System
// ============================================================

import { Hono } from 'hono'
import { store } from '../lib/store'
import { shellHtml, healthBadge, statusBadge, signalBadge, burnBar, decisionBadge } from '../lib/ui'

const dashboard = new Hono()

dashboard.get('/', (c) => {
  const d = store.getDashboard()
  const eco = d.ecosystem

  // ── ECOSYSTEM SUMMARY CARDS ───────────────────────────────
  const ecoCards = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="card stat-card">
        <div class="stat-val text-blue-400">${eco.total_budget_used}<span class="text-slate-600 text-lg">/${eco.total_budget_cap}</span></div>
        <div class="stat-lbl">Budget Used / Cap (BU)</div>
        <div class="mt-2">${burnBar(eco.pressure_pct, eco.pressure_pct >= 100 ? 'exceeded' : eco.pressure_pct >= 80 ? 'warning' : 'safe')}</div>
        <div class="text-xs text-slate-500 mt-1">${eco.pressure_pct}% pressure</div>
      </div>
      <div class="card stat-card">
        <div class="stat-val ${eco.budget_remaining <= 0 ? 'text-red-400' : 'text-green-400'}">${eco.budget_remaining}</div>
        <div class="stat-lbl">Budget Remaining (BU)</div>
        <div class="text-xs text-slate-500 mt-2">${eco.period_label}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-val text-yellow-400">${eco.active_sessions}<span class="text-slate-600 text-lg">/${eco.active_session_limit}</span></div>
        <div class="stat-lbl">Active Sessions</div>
        <div class="text-xs text-slate-500 mt-2">${eco.blocked_sessions} blocked</div>
      </div>
      <div class="card stat-card">
        <div class="stat-val text-purple-400">${eco.active_lanes}<span class="text-slate-600 text-lg">/${eco.active_lane_limit}</span></div>
        <div class="stat-lbl">Active Lanes</div>
        <div class="text-xs text-slate-500 mt-2">${eco.overloaded_lanes} overloaded</div>
      </div>
    </div>
  `

  // ── ECOSYSTEM HEALTH BANNER ───────────────────────────────
  const ecoHealthColor: Record<string, string> = {
    healthy: 'border-green-800 bg-green-950',
    constrained: 'border-yellow-800 bg-yellow-950',
    overloaded: 'border-red-800 bg-red-950',
    frozen: 'border-blue-800 bg-blue-950'
  }
  const ecoHealthBanner = `
    <div class="flex items-center justify-between card p-4 mb-6 border ${ecoHealthColor[eco.ecosystem_health] || ''}">
      <div class="flex items-center gap-3">
        <i class="fas fa-globe text-slate-400"></i>
        <span class="text-sm font-semibold text-slate-300">Ecosystem: ${eco.period_label}</span>
        ${healthBadge(eco.ecosystem_health)}
      </div>
      <div class="flex items-center gap-4 text-xs text-slate-500">
        <span>Freeze rule: ${(eco.freeze_rules || '').substring(0, 60)}${(eco.freeze_rules || '').length > 60 ? '...' : ''}</span>
        <a href="/ecosystem" class="text-blue-400 hover:text-blue-300">Configure →</a>
      </div>
    </div>
  `

  // ── RECOMMENDED ACTIONS ───────────────────────────────────
  const actionsHtml = d.recommended_actions.length === 0
    ? `<div class="text-slate-500 text-sm py-4 text-center">No actions required. System healthy.</div>`
    : d.recommended_actions.map(a => `
        <div class="action-banner action-${a.priority} flex items-start justify-between gap-3 mb-2">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-bold uppercase tracking-wide ${a.priority === 'high' ? 'text-red-400' : a.priority === 'medium' ? 'text-yellow-400' : 'text-blue-400'}">${a.priority}</span>
              <span class="text-xs font-bold text-white">${a.action}</span>
              <span class="text-xs text-slate-400">${a.entity_type.toUpperCase()}: ${a.entity_name}</span>
            </div>
            <p class="text-xs text-slate-400">${a.reason}</p>
          </div>
          <a href="/${a.entity_type === 'session' ? 'sessions' : a.entity_type === 'lane' ? 'lanes' : 'ecosystem'}/${a.entity_id}" class="text-blue-400 hover:text-blue-300 text-xs flex-shrink-0">View →</a>
        </div>
      `).join('')

  // ── ACTIVE SESSIONS TABLE ─────────────────────────────────
  const activeSessionsHtml = d.active_sessions.length === 0
    ? `<div class="text-slate-500 text-sm py-4 text-center">No active sessions</div>`
    : `<table class="w-full text-sm">
        <thead><tr class="text-left text-xs text-slate-500 uppercase border-b border-slate-700">
          <th class="pb-2 pr-4">Session</th>
          <th class="pb-2 pr-4">Lane</th>
          <th class="pb-2 pr-4">Budget</th>
          <th class="pb-2 pr-4">Signal</th>
          <th class="pb-2">Status</th>
        </tr></thead>
        <tbody>
        ${d.active_sessions.map(s => `
          <tr class="table-row">
            <td class="py-2 pr-4">
              <a href="/sessions/${s.id}" class="font-semibold text-white hover:text-blue-400">${s.id}</a>
              <div class="text-xs text-slate-500 truncate max-w-xs">${s.title}</div>
            </td>
            <td class="py-2 pr-4 text-slate-400 text-xs">${s.lane_name}</td>
            <td class="py-2 pr-4" style="min-width:140px">
              <div class="text-xs text-slate-300 mb-1">${s.actual_budget_unit}/${s.hard_cap_budget_unit} BU (${s.burn_pct}%)</div>
              ${burnBar(s.burn_pct, s.cap_status)}
            </td>
            <td class="py-2 pr-4">${signalBadge(s.go_stop_signal)}</td>
            <td class="py-2">${statusBadge(s.status)}</td>
          </tr>
        `).join('')}
        </tbody>
      </table>`

  // ── BLOCKED SESSIONS ──────────────────────────────────────
  const blockedHtml = d.blocked_sessions.length === 0
    ? `<div class="text-slate-500 text-sm py-4 text-center">No blocked sessions</div>`
    : d.blocked_sessions.map(s => `
        <div class="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
          <div>
            <a href="/sessions/${s.id}" class="font-semibold text-white hover:text-blue-400 text-sm">${s.id}: ${s.title}</a>
            <div class="text-xs text-red-400 mt-0.5">Blocker: ${s.blocker_type.replace('_',' ')}</div>
          </div>
          <div class="flex items-center gap-2">
            ${signalBadge(s.go_stop_signal)}
            ${statusBadge(s.status)}
          </div>
        </div>
      `).join('')

  // ── RECENT DECISIONS ──────────────────────────────────────
  const decisionsHtml = d.recent_decisions.length === 0
    ? `<div class="text-slate-500 text-sm py-4 text-center">No decisions logged</div>`
    : d.recent_decisions.map(dec => `
        <div class="flex items-start gap-3 py-2 border-b border-slate-700 last:border-0">
          <div class="mt-0.5">${decisionBadge(dec.decision_type)}</div>
          <div class="flex-1 min-w-0">
            <div class="text-xs text-slate-400"><span class="font-semibold text-slate-300">${dec.entity_type.toUpperCase()}</span> / ${dec.entity_id}</div>
            <p class="text-xs text-slate-500 truncate">${dec.reason}</p>
          </div>
          <div class="text-xs text-slate-600 flex-shrink-0">${dec.created_at.split('T')[0]}</div>
        </div>
      `).join('')

  // ── ACTIVE LANES ──────────────────────────────────────────
  const lanesHtml = d.active_lanes.length === 0
    ? `<div class="text-slate-500 text-sm py-4 text-center">No active lanes</div>`
    : d.active_lanes.map(l => `
        <div class="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
          <div>
            <a href="/lanes/${l.id}" class="font-semibold text-white hover:text-blue-400 text-sm">${l.name}</a>
            <div class="text-xs text-slate-500">${l.category} · ${l.active_session_count} active / ${l.session_count} total sessions</div>
          </div>
          <div class="flex items-center gap-3">
            <div style="width:80px">
              <div class="text-xs text-slate-400 mb-1 text-right">${l.actual_budget_unit}/${l.hard_cap_budget_unit} BU</div>
              ${burnBar(l.burn_pct, l.over_cap ? 'exceeded' : l.burn_pct >= 80 ? 'warning' : 'safe')}
            </div>
            ${healthBadge(l.lane_health)}
          </div>
        </div>
      `).join('')

  const body = `
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-bold text-white">Dashboard</h2>
          <p class="text-slate-500 text-sm mt-0.5">Operational overview — current truth</p>
        </div>
        <div class="flex gap-2">
          <a href="/sessions/new" class="btn-primary text-sm"><i class="fas fa-plus mr-1"></i>New Session</a>
          <a href="/decisions/new" class="btn-secondary text-sm"><i class="fas fa-gavel mr-1"></i>Log Decision</a>
        </div>
      </div>

      ${ecoCards}
      ${ecoHealthBanner}

      <!-- Recommended Actions -->
      <div class="card p-4 mb-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-white text-sm"><i class="fas fa-triangle-exclamation text-yellow-400 mr-2"></i>Recommended Actions</h3>
          <span class="text-xs text-slate-500">${d.recommended_actions.length} item${d.recommended_actions.length !== 1 ? 's' : ''}</span>
        </div>
        ${actionsHtml}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <!-- Active Sessions -->
        <div class="card p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-white text-sm"><i class="fas fa-list-check text-blue-400 mr-2"></i>Active Sessions</h3>
            <a href="/sessions" class="text-xs text-blue-400 hover:text-blue-300">View all →</a>
          </div>
          ${activeSessionsHtml}
        </div>

        <!-- Active Lanes -->
        <div class="card p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-white text-sm"><i class="fas fa-road text-purple-400 mr-2"></i>Active Lanes</h3>
            <a href="/lanes" class="text-xs text-blue-400 hover:text-blue-300">View all →</a>
          </div>
          ${lanesHtml}
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Blocked Sessions -->
        <div class="card p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-white text-sm"><i class="fas fa-ban text-red-400 mr-2"></i>Blocked Sessions</h3>
            <span class="text-xs text-slate-500">${d.blocked_sessions.length} blocked</span>
          </div>
          ${blockedHtml}
        </div>

        <!-- Recent Decisions -->
        <div class="card p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-white text-sm"><i class="fas fa-book-open text-green-400 mr-2"></i>Recent Decisions</h3>
            <a href="/decisions" class="text-xs text-blue-400 hover:text-blue-300">View all →</a>
          </div>
          ${decisionsHtml}
        </div>
      </div>
    </div>
  `

  return c.html(shellHtml({ title: 'Dashboard', activeNav: 'dashboard', body }))
})

export default dashboard
