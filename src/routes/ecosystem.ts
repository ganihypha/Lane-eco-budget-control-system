// ============================================================
// ECOSYSTEM ROUTE — Lane-Eco Budget Control System
// ============================================================

import { Hono } from 'hono'
import { store } from '../lib/store'
import { shellHtml, healthBadge, burnBar, statusBadge } from '../lib/ui'
import type { Ecosystem } from '../lib/types'

const ecosystem = new Hono()

// GET ecosystem detail + control panel
ecosystem.get('/', (c) => {
  const eco = store.getEcosystem()
  const allLanes = store.listLanes()
  const allSessions = store.listSessions()

  const ecoHealthColors: Record<string, string> = {
    healthy: '#14532d',
    constrained: '#78350f',
    overloaded: '#7f1d1d',
    frozen: '#1e3a5f'
  }
  const bgColor = ecoHealthColors[eco.ecosystem_health] || '#1e293b'

  const lanesHtml = allLanes.map(l => {
    const pct = l.hard_cap_budget_unit > 0 ? Math.round((l.actual_budget_unit / l.hard_cap_budget_unit) * 100) : 0
    const capStatus = l.over_cap ? 'exceeded' : pct >= 80 ? 'warning' : 'safe'
    return `
      <div class="flex items-center justify-between py-3 border-b border-slate-700 last:border-0 gap-4">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <a href="/lanes/${l.id}" class="font-semibold text-white hover:text-blue-400 text-sm">${l.name}</a>
            ${statusBadge(l.status)}
            ${healthBadge(l.lane_health)}
          </div>
          <div class="text-xs text-slate-500 mt-0.5">${l.category} · ${l.active_session_count} active / ${l.session_count} sessions</div>
        </div>
        <div style="width:160px">
          <div class="text-xs text-slate-400 mb-1 text-right">${l.actual_budget_unit}/${l.hard_cap_budget_unit} BU (${pct}%)</div>
          ${burnBar(pct, capStatus)}
        </div>
      </div>
    `
  }).join('')

  const activeSessionsList = allSessions.filter(s => s.status === 'active').map(s => `
    <div class="flex items-center justify-between py-2 border-b border-slate-700 last:border-0 gap-3">
      <div>
        <a href="/sessions/${s.id}" class="text-sm font-semibold text-white hover:text-blue-400">${s.id}: ${s.title}</a>
        <div class="text-xs text-slate-500">${s.lane_name}</div>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-slate-400">${s.actual_budget_unit}/${s.hard_cap_budget_unit} BU</span>
        <span class="${s.go_stop_signal === 'GO' ? 'signal-GO' : s.go_stop_signal === 'STOP' ? 'signal-STOP' : 'signal-WATCH'} text-xs px-2 py-0.5 rounded">${s.go_stop_signal}</span>
      </div>
    </div>
  `).join('') || '<div class="text-slate-500 text-sm py-2">No active sessions</div>'

  // Pressure gauge visual
  const pressurePct = eco.pressure_pct
  const gaugeColor = pressurePct >= 100 ? '#ef4444' : pressurePct >= 85 ? '#f59e0b' : pressurePct >= 65 ? '#f59e0b' : '#22c55e'

  const freezeRuleHtml = `
    <div class="card p-4 mb-6">
      <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Freeze Rules</h3>
      <p class="text-sm text-slate-300">${eco.freeze_rules || 'No freeze rules defined.'}</p>
    </div>
  `

  const body = `
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-bold text-white">Ecosystem Controller</h2>
          <p class="text-slate-500 text-sm mt-0.5">Period: ${eco.period_label} · Top-level budget control</p>
        </div>
        <div class="flex gap-2">
          <a href="/decisions/new?entity_type=ecosystem&entity_id=${eco.id}" class="btn-primary text-sm">Log Decision</a>
          <a href="/ecosystem/edit" class="btn-secondary text-sm">Configure</a>
        </div>
      </div>

      <!-- Ecosystem Health Banner -->
      <div class="card p-4 mb-6 border" style="border-color:${bgColor === '#14532d' ? '#166534' : bgColor === '#78350f' ? '#92400e' : bgColor === '#7f1d1d' ? '#991b1b' : '#1d4ed8'};background:${bgColor}22">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <i class="fas fa-globe text-2xl text-slate-400"></i>
            <div>
              <div class="text-sm font-semibold text-white">Ecosystem Health</div>
              <div class="text-xs text-slate-400">${eco.period_label}</div>
            </div>
            ${healthBadge(eco.ecosystem_health)}
          </div>
          <div class="text-right">
            <div class="text-3xl font-bold" style="color:${gaugeColor}">${eco.pressure_pct}%</div>
            <div class="text-xs text-slate-500">budget pressure</div>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="card stat-card">
          <div class="stat-val" style="color:${gaugeColor}">${eco.total_budget_used}<span class="text-slate-600 text-lg">/${eco.total_budget_cap}</span></div>
          <div class="stat-lbl">Budget Used / Cap (BU)</div>
          <div class="mt-2">${burnBar(eco.pressure_pct, eco.pressure_pct >= 100 ? 'exceeded' : eco.pressure_pct >= 80 ? 'warning' : 'safe')}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-val ${eco.budget_remaining <= 0 ? 'text-red-400' : 'text-green-400'}">${eco.budget_remaining}</div>
          <div class="stat-lbl">Budget Remaining (BU)</div>
        </div>
        <div class="card stat-card">
          <div class="stat-val ${eco.active_lanes > eco.active_lane_limit ? 'text-red-400' : 'text-yellow-400'}">${eco.active_lanes}<span class="text-slate-600 text-lg">/${eco.active_lane_limit}</span></div>
          <div class="stat-lbl">Active Lanes / Limit</div>
        </div>
        <div class="card stat-card">
          <div class="stat-val ${eco.active_sessions > eco.active_session_limit ? 'text-red-400' : 'text-blue-400'}">${eco.active_sessions}<span class="text-slate-600 text-lg">/${eco.active_session_limit}</span></div>
          <div class="stat-lbl">Active Sessions / Limit</div>
        </div>
      </div>

      <!-- Pressure Signals -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        ${eco.pressure_pct >= 80 ? `<div class="card p-4 border border-red-800 bg-red-950">
          <div class="flex items-center gap-2 text-red-400 font-bold text-sm mb-1"><i class="fas fa-circle-exclamation"></i>Budget Pressure Critical</div>
          <p class="text-xs text-red-300">Ecosystem at ${eco.pressure_pct}% of total cap. Freeze new sessions immediately.</p>
        </div>` : ''}
        ${eco.active_lanes > eco.active_lane_limit ? `<div class="card p-4 border border-red-800 bg-red-950">
          <div class="flex items-center gap-2 text-red-400 font-bold text-sm mb-1"><i class="fas fa-road"></i>Lane Limit Exceeded</div>
          <p class="text-xs text-red-300">${eco.active_lanes} active lanes vs limit of ${eco.active_lane_limit}. Move lanes to maintenance.</p>
        </div>` : ''}
        ${eco.overloaded_lanes > 0 ? `<div class="card p-4 border border-yellow-800 bg-yellow-950">
          <div class="flex items-center gap-2 text-yellow-400 font-bold text-sm mb-1"><i class="fas fa-triangle-exclamation"></i>${eco.overloaded_lanes} Lane(s) Overloaded</div>
          <p class="text-xs text-yellow-300">Lane(s) approaching or exceeding capacity. Review and freeze if needed.</p>
        </div>` : ''}
        ${eco.blocked_sessions > 0 ? `<div class="card p-4 border border-orange-800 bg-orange-950">
          <div class="flex items-center gap-2 text-orange-400 font-bold text-sm mb-1"><i class="fas fa-ban"></i>${eco.blocked_sessions} Blocked Session(s)</div>
          <p class="text-xs text-orange-300">Sessions with active blockers. Resolve or mark cancelled to clean up ecosystem state.</p>
        </div>` : ''}
        ${eco.ecosystem_health === 'healthy' && eco.pressure_pct < 65 && eco.active_lanes <= eco.active_lane_limit ? `<div class="card p-4 border border-green-800 bg-green-950 md:col-span-2">
          <div class="flex items-center gap-2 text-green-400 font-bold text-sm"><i class="fas fa-circle-check"></i>Ecosystem Healthy — New sessions allowed</div>
        </div>` : ''}
      </div>

      ${freezeRuleHtml}

      <!-- All Lanes Overview -->
      <div class="card p-4 mb-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wide">All Lanes</h3>
          <a href="/lanes" class="text-blue-400 text-xs hover:text-blue-300">Manage Lanes →</a>
        </div>
        ${lanesHtml || '<div class="text-slate-500 text-sm">No lanes defined</div>'}
      </div>

      <!-- Active Sessions in Ecosystem -->
      <div class="card p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wide">Active Sessions in Ecosystem</h3>
          <a href="/sessions" class="text-blue-400 text-xs hover:text-blue-300">View All →</a>
        </div>
        ${activeSessionsList}
      </div>
    </div>
  `
  return c.html(shellHtml({ title: 'Ecosystem', activeNav: 'ecosystem', body }))
})

// EDIT FORM
ecosystem.get('/edit', (c) => {
  const eco = store.getEcosystem()

  const body = `
    <div class="p-6 max-w-2xl">
      <div class="mb-6">
        <a href="/ecosystem" class="text-slate-500 hover:text-white text-sm">← Ecosystem</a>
        <h2 class="text-xl font-bold text-white mt-1">Configure Ecosystem</h2>
      </div>
      <div class="card p-6">
        <form method="POST" action="/ecosystem">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label class="form-label">Period Label</label>
              <input type="text" name="period_label" value="${eco.period_label}" placeholder="e.g. Q2-2026"/>
            </div>
            <div>
              <label class="form-label">Total Budget Cap (BU)</label>
              <input type="number" name="total_budget_cap" value="${eco.total_budget_cap}" min="0" step="1"/>
            </div>
            <div>
              <label class="form-label">Active Lane Limit</label>
              <input type="number" name="active_lane_limit" value="${eco.active_lane_limit}" min="1"/>
            </div>
            <div>
              <label class="form-label">Active Session Limit</label>
              <input type="number" name="active_session_limit" value="${eco.active_session_limit}" min="1"/>
            </div>
            <div class="md:col-span-2">
              <label class="form-label">Freeze Rules</label>
              <textarea name="freeze_rules" rows="3" placeholder="When should new sessions be frozen?">${eco.freeze_rules}</textarea>
            </div>
            <div class="md:col-span-2">
              <label class="form-label">Priority Order (one lane per line)</label>
              <textarea name="priority_order" rows="4" placeholder="Lane names in priority order">${(eco.priority_order || []).join('\n')}</textarea>
            </div>
            <div class="md:col-span-2">
              <label class="form-label">Notes</label>
              <textarea name="notes" rows="2">${eco.notes}</textarea>
            </div>
          </div>
          <div class="flex gap-3 mt-6">
            <button type="submit" class="btn-primary">Save Ecosystem Config</button>
            <a href="/ecosystem" class="btn-secondary">Cancel</a>
          </div>
        </form>
      </div>
    </div>
  `
  return c.html(shellHtml({ title: 'Ecosystem Config', activeNav: 'ecosystem', body }))
})

// UPDATE
ecosystem.post('/', async (c) => {
  const form = await c.req.formData()
  const data: Partial<Ecosystem> = {
    period_label: form.get('period_label') as string,
    total_budget_cap: Number(form.get('total_budget_cap')),
    active_lane_limit: Number(form.get('active_lane_limit')),
    active_session_limit: Number(form.get('active_session_limit')),
    freeze_rules: form.get('freeze_rules') as string,
    priority_order: ((form.get('priority_order') as string) || '').split('\n').filter(Boolean),
    notes: form.get('notes') as string
  }
  store.updateEcosystem(data)
  return c.redirect('/ecosystem')
})

export default ecosystem
