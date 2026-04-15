// ============================================================
// LANES ROUTE — Lane-Eco Budget Control System
// ============================================================

import { Hono } from 'hono'
import { store } from '../lib/store'
import { shellHtml, statusBadge, healthBadge, burnBar, signalBadge, blockerBadge } from '../lib/ui'
import type { Lane } from '../lib/types'

const lanes = new Hono()

// ─── FORM HELPER ────────────────────────────────────────────

function laneForm(data: Partial<Lane> = {}, action = '/lanes', method = 'POST', submitLabel = 'Create Lane'): string {
  return `
    <form method="POST" action="${action}">
      ${method !== 'POST' ? `<input type="hidden" name="_method" value="${method}">` : ''}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="form-label">Lane ID</label>
          <input type="text" name="id" value="${data.id || ''}" placeholder="e.g. lane-barberkash" ${data.id ? 'readonly style="opacity:0.5"' : ''}/>
        </div>
        <div>
          <label class="form-label">Lane Name *</label>
          <input type="text" name="name" value="${data.name || ''}" placeholder="Short descriptive name" required/>
        </div>
        <div>
          <label class="form-label">Category</label>
          <input type="text" name="category" value="${data.category || ''}" placeholder="e.g. Product, Infrastructure, Research"/>
        </div>
        <div>
          <label class="form-label">Status</label>
          <select name="status">
            ${['planned','active','maintenance','blocked','closed'].map(s =>
              `<option value="${s}" ${data.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="md:col-span-2">
          <label class="form-label">Primary Goal *</label>
          <textarea name="primary_goal" rows="2" placeholder="What this lane is trying to achieve">${data.primary_goal || ''}</textarea>
        </div>
        <div>
          <label class="form-label">Max Session Count</label>
          <input type="number" name="max_session_count" value="${data.max_session_count ?? 10}" min="1"/>
        </div>
        <div>
          <label class="form-label">Owner</label>
          <input type="text" name="owner" value="${data.owner || 'Founder'}" placeholder="Founder"/>
        </div>
        <div>
          <label class="form-label">Planned Budget (BU)</label>
          <input type="number" name="planned_budget_unit" value="${data.planned_budget_unit ?? ''}" min="0" step="0.5" placeholder="0"/>
        </div>
        <div>
          <label class="form-label">Hard Cap (BU) *</label>
          <input type="number" name="hard_cap_budget_unit" value="${data.hard_cap_budget_unit ?? ''}" min="0" step="0.5" placeholder="0" required/>
        </div>
        <div class="md:col-span-2">
          <label class="form-label">Exit Criteria</label>
          <textarea name="exit_criteria" rows="2" placeholder="When is this lane considered complete?">${data.exit_criteria || ''}</textarea>
        </div>
        <div class="md:col-span-2">
          <label class="form-label">Notes</label>
          <textarea name="notes" rows="2" placeholder="Operational context">${data.notes || ''}</textarea>
        </div>
      </div>
      <div class="flex gap-3 mt-6">
        <button type="submit" class="btn-primary">${submitLabel}</button>
        <a href="/lanes" class="btn-secondary">Cancel</a>
      </div>
    </form>
  `
}

// ─── ROUTES ─────────────────────────────────────────────────

// LIST
lanes.get('/', (c) => {
  const allLanes = store.listLanes()

  const rows = allLanes.length === 0
    ? `<tr><td colspan="7" class="text-center text-slate-500 py-8">No lanes found</td></tr>`
    : allLanes.map(l => `
        <tr class="table-row hover:bg-slate-800/40">
          <td class="py-3 pr-4">
            <a href="/lanes/${l.id}" class="font-semibold text-blue-400 hover:text-blue-300 text-sm">${l.name}</a>
            <div class="text-xs text-slate-500">${l.category}</div>
          </td>
          <td class="py-3 pr-4">${statusBadge(l.status)}</td>
          <td class="py-3 pr-4">${healthBadge(l.lane_health)}</td>
          <td class="py-3 pr-4" style="min-width:140px">
            <div class="text-xs text-slate-400 mb-1">${l.actual_budget_unit}/${l.hard_cap_budget_unit} BU (${l.burn_pct}%)</div>
            ${burnBar(l.burn_pct, l.over_cap ? 'exceeded' : l.burn_pct >= 80 ? 'warning' : 'safe')}
          </td>
          <td class="py-3 pr-4 text-sm text-slate-300">${l.active_session_count} / ${l.session_count}</td>
          <td class="py-3 pr-4 text-xs text-slate-500">${l.owner}</td>
          <td class="py-3">
            <a href="/lanes/${l.id}" class="text-xs text-blue-400 hover:text-blue-300">Detail →</a>
          </td>
        </tr>
      `).join('')

  const summaryCards = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="card stat-card">
        <div class="stat-val text-white">${allLanes.length}</div>
        <div class="stat-lbl">Total Lanes</div>
      </div>
      <div class="card stat-card">
        <div class="stat-val text-green-400">${allLanes.filter(l=>l.status==='active').length}</div>
        <div class="stat-lbl">Active</div>
      </div>
      <div class="card stat-card">
        <div class="stat-val text-red-400">${allLanes.filter(l=>l.lane_health==='overloaded'||l.lane_health==='frozen').length}</div>
        <div class="stat-lbl">Overloaded / Frozen</div>
      </div>
      <div class="card stat-card">
        <div class="stat-val text-purple-400">${allLanes.filter(l=>l.status==='maintenance').length}</div>
        <div class="stat-lbl">Maintenance</div>
      </div>
    </div>
  `

  const body = `
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-bold text-white">Lanes</h2>
          <p class="text-slate-500 text-sm mt-0.5">Operational streams and their budget status</p>
        </div>
        <a href="/lanes/new" class="btn-primary"><i class="fas fa-plus mr-1"></i>New Lane</a>
      </div>

      ${summaryCards}

      <div class="card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="border-b border-slate-700">
            <tr class="text-left text-xs text-slate-500 uppercase">
              <th class="p-4 pb-3">Lane</th>
              <th class="p-4 pb-3 pl-0">Status</th>
              <th class="p-4 pb-3 pl-0">Health</th>
              <th class="p-4 pb-3 pl-0">Budget</th>
              <th class="p-4 pb-3 pl-0">Sessions (Act/Tot)</th>
              <th class="p-4 pb-3 pl-0">Owner</th>
              <th class="p-4 pb-3 pl-0"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800">
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `
  return c.html(shellHtml({ title: 'Lanes', activeNav: 'lanes', body }))
})

// NEW FORM
lanes.get('/new', (c) => {
  const body = `
    <div class="p-6 max-w-3xl">
      <div class="mb-6">
        <h2 class="text-xl font-bold text-white">New Lane</h2>
        <p class="text-slate-500 text-sm mt-0.5">Create a new operational stream</p>
      </div>
      <div class="card p-6">
        ${laneForm()}
      </div>
    </div>
  `
  return c.html(shellHtml({ title: 'New Lane', activeNav: 'lanes', body }))
})

// CREATE
lanes.post('/', async (c) => {
  const form = await c.req.formData()
  const data: Partial<Lane> = {
    id: (form.get('id') as string) || undefined,
    name: form.get('name') as string,
    category: form.get('category') as string,
    primary_goal: form.get('primary_goal') as string,
    status: form.get('status') as any,
    max_session_count: Number(form.get('max_session_count')),
    planned_budget_unit: Number(form.get('planned_budget_unit')),
    hard_cap_budget_unit: Number(form.get('hard_cap_budget_unit')),
    exit_criteria: form.get('exit_criteria') as string,
    owner: form.get('owner') as string,
    notes: form.get('notes') as string
  }
  const lane = store.createLane(data)
  return c.redirect(`/lanes/${lane.id}`)
})

// DETAIL
lanes.get('/:id', (c) => {
  const id = c.req.param('id')
  const l = store.getLane(id)
  if (!l) return c.html(shellHtml({ title: '404', activeNav: 'lanes', body: '<div class="p-6 text-slate-400">Lane not found.</div>' }), 404)

  const sessions = (l.sessions || []).map(s => store.getSession(s.id)).filter(Boolean) as any[]
  const decisions = store.listDecisions().filter(d => d.entity_id === l.id)

  const sessionsHtml = sessions.length === 0
    ? `<div class="text-slate-500 text-sm py-2">No sessions in this lane yet. <a href="/sessions/new" class="text-blue-400">Create one →</a></div>`
    : `<table class="w-full text-sm">
        <thead><tr class="text-left text-xs text-slate-500 uppercase border-b border-slate-700">
          <th class="pb-2 pr-4">ID</th>
          <th class="pb-2 pr-4">Title</th>
          <th class="pb-2 pr-4">Status</th>
          <th class="pb-2 pr-4">Budget</th>
          <th class="pb-2 pr-4">Signal</th>
          <th class="pb-2">Blocker</th>
        </tr></thead>
        <tbody>
        ${sessions.map(s => `
          <tr class="table-row">
            <td class="py-2 pr-4"><a href="/sessions/${s.id}" class="font-mono text-blue-400 hover:text-blue-300 text-xs">${s.id}</a></td>
            <td class="py-2 pr-4 text-slate-300 text-sm">${s.title}</td>
            <td class="py-2 pr-4">${statusBadge(s.status)}</td>
            <td class="py-2 pr-4" style="min-width:100px">
              <div class="text-xs text-slate-400 mb-1">${s.actual_budget_unit}/${s.hard_cap_budget_unit} BU</div>
              ${burnBar(s.burn_pct, s.cap_status)}
            </td>
            <td class="py-2 pr-4">${signalBadge(s.go_stop_signal)}</td>
            <td class="py-2">${blockerBadge(s.blocker_type)}</td>
          </tr>
        `).join('')}
        </tbody>
      </table>`

  const decisionsHtml = decisions.length === 0
    ? `<div class="text-slate-500 text-sm py-2">No decisions for this lane</div>`
    : decisions.map(d => {
        const colors: Record<string, string> = { go:'#14532d:#86efac', stop:'#7f1d1d:#fca5a5', freeze:'#1e3a5f:#93c5fd', split:'#78350f:#fcd34d', continue:'#14532d:#86efac', escalate:'#7f1d1d:#fca5a5', defer:'#1f2937:#9ca3af', close:'#1f2937:#6b7280' }
        const [bg, fg] = (colors[d.decision_type] || '#1f2937:#9ca3af').split(':')
        return `
          <div class="flex items-start gap-3 py-2 border-b border-slate-700 last:border-0">
            <span style="background:${bg};color:${fg};font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:uppercase;flex-shrink:0">${d.decision_type}</span>
            <div class="flex-1"><p class="text-xs text-slate-300">${d.reason}</p><div class="text-xs text-slate-600 mt-1">${d.created_at.split('T')[0]}</div></div>
          </div>`
      }).join('')

  const body = `
    <div class="p-6">
      <div class="flex items-start justify-between mb-6">
        <div>
          <div class="flex items-center gap-3 mb-1">
            <a href="/lanes" class="text-slate-500 hover:text-white text-sm">Lanes</a>
            <span class="text-slate-600">/</span>
            <span class="font-bold text-white">${l.name}</span>
            ${statusBadge(l.status)}
            ${healthBadge(l.lane_health)}
          </div>
          <h2 class="text-xl font-bold text-white">${l.name}</h2>
          <p class="text-slate-500 text-sm mt-0.5">${l.primary_goal}</p>
        </div>
        <div class="flex gap-2 flex-shrink-0">
          <a href="/lanes/${l.id}/edit" class="btn-secondary text-sm">Edit</a>
          <a href="/decisions/new?entity_type=lane&entity_id=${l.id}" class="btn-primary text-sm">Log Decision</a>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div class="card p-4 md:col-span-2">
          <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Budget Status</h3>
          <div class="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div class="text-2xl font-bold text-blue-400">${l.planned_budget_unit}</div>
              <div class="text-xs text-slate-500">Planned (BU)</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-yellow-400">${l.actual_budget_unit}</div>
              <div class="text-xs text-slate-500">Actual Burn (BU)</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-red-400">${l.hard_cap_budget_unit}</div>
              <div class="text-xs text-slate-500">Hard Cap (BU)</div>
            </div>
          </div>
          <div class="mb-2">${burnBar(l.burn_pct, l.over_cap ? 'exceeded' : l.burn_pct >= 80 ? 'warning' : 'safe')}</div>
          <div class="flex justify-between text-xs text-slate-500">
            <span>${l.burn_pct}% of cap</span>
            <span>${l.session_count} sessions total · ${l.active_session_count} active · ${l.blocked_session_count} blocked</span>
          </div>
          ${l.over_cap ? `<div class="mt-3 text-xs text-red-400 font-semibold p-2 bg-red-950 rounded border border-red-800">OVER CAP: Lane has exceeded hard cap. Freeze required.</div>` : ''}
        </div>

        <div class="card p-4">
          <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Lane Meta</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between"><span class="text-slate-500">Category</span><span class="text-slate-300">${l.category}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Max Sessions</span><span class="text-slate-300">${l.max_session_count}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Owner</span><span class="text-slate-300">${l.owner}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Health</span>${healthBadge(l.lane_health)}</div>
          </div>
          ${l.exit_criteria ? `<div class="mt-4"><div class="text-xs text-slate-500 mb-1">Exit Criteria</div><p class="text-xs text-slate-400">${l.exit_criteria}</p></div>` : ''}
          ${l.notes ? `<div class="mt-3"><div class="text-xs text-slate-500 mb-1">Notes</div><p class="text-xs text-slate-400">${l.notes}</p></div>` : ''}
        </div>
      </div>

      <!-- Quick Status Actions -->
      <div class="card p-4 mb-6">
        <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Quick Lane Actions</h3>
        <div class="flex flex-wrap gap-2">
          ${['active','maintenance','blocked','closed'].map(st =>
            l.status === st ? '' :
            `<form method="POST" action="/lanes/${l.id}/status" style="display:inline">
              <input type="hidden" name="status" value="${st}"/>
              <button type="submit" class="${st === 'active' ? 'btn-primary' : st === 'maintenance' ? 'btn-secondary' : 'btn-danger'} text-xs">
                ${st === 'maintenance' ? 'Move to Maintenance' : st === 'blocked' ? 'Mark Blocked' : st === 'closed' ? 'Close Lane' : 'Mark ' + st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            </form>`
          ).join('')}
          <a href="/sessions/new" class="btn-secondary text-xs"><i class="fas fa-plus mr-1"></i>Add Session to Lane</a>
        </div>
      </div>

      <div class="card p-4 mb-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wide">Sessions in This Lane</h3>
          <a href="/sessions/new" class="text-blue-400 text-xs hover:text-blue-300">Add Session →</a>
        </div>
        ${sessionsHtml}
      </div>

      <div class="card p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wide">Decision Log (this lane)</h3>
          <a href="/decisions/new?entity_type=lane&entity_id=${l.id}" class="text-blue-400 text-xs hover:text-blue-300">Log Decision →</a>
        </div>
        ${decisionsHtml}
      </div>
    </div>
  `
  return c.html(shellHtml({ title: l.name, activeNav: 'lanes', body }))
})

// EDIT
lanes.get('/:id/edit', (c) => {
  const id = c.req.param('id')
  const l = store.getLane(id)
  if (!l) return c.redirect('/lanes')
  const body = `
    <div class="p-6 max-w-3xl">
      <div class="mb-6">
        <a href="/lanes/${l.id}" class="text-slate-500 hover:text-white text-sm">← ${l.name}</a>
        <h2 class="text-xl font-bold text-white mt-1">Edit Lane</h2>
      </div>
      <div class="card p-6">
        ${laneForm(l, `/lanes/${l.id}`, 'PUT', 'Save Changes')}
      </div>
      <div class="mt-4">
        <form method="POST" action="/lanes/${l.id}/delete" onsubmit="return confirm('Delete lane? Sessions will remain but lose lane assignment.')">
          <button type="submit" class="btn-danger text-sm"><i class="fas fa-trash mr-1"></i>Delete Lane</button>
        </form>
      </div>
    </div>
  `
  return c.html(shellHtml({ title: `Edit ${l.name}`, activeNav: 'lanes', body }))
})

// UPDATE
lanes.post('/:id', async (c) => {
  const id = c.req.param('id')
  const form = await c.req.formData()
  if (form.get('_method') !== 'PUT') return c.redirect(`/lanes/${id}`)
  const data: Partial<Lane> = {
    name: form.get('name') as string,
    category: form.get('category') as string,
    primary_goal: form.get('primary_goal') as string,
    status: form.get('status') as any,
    max_session_count: Number(form.get('max_session_count')),
    planned_budget_unit: Number(form.get('planned_budget_unit')),
    hard_cap_budget_unit: Number(form.get('hard_cap_budget_unit')),
    exit_criteria: form.get('exit_criteria') as string,
    owner: form.get('owner') as string,
    notes: form.get('notes') as string
  }
  store.updateLane(id, data)
  return c.redirect(`/lanes/${id}`)
})

// QUICK STATUS
lanes.post('/:id/status', async (c) => {
  const id = c.req.param('id')
  const form = await c.req.formData()
  const status = form.get('status') as any
  if (status) store.updateLane(id, { status })
  return c.redirect(`/lanes/${id}`)
})

// DELETE
lanes.post('/:id/delete', (c) => {
  store.deleteLane(c.req.param('id'))
  return c.redirect('/lanes')
})

export default lanes
