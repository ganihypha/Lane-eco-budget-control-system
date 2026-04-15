// ============================================================
// SESSIONS ROUTE — Lane-Eco Budget Control System
// ============================================================

import { Hono } from 'hono'
import { store } from '../lib/store'
import { shellHtml, statusBadge, signalBadge, burnBar, blockerBadge, intensityDots, healthBadge } from '../lib/ui'
import type { Session } from '../lib/types'

const sessions = new Hono()

// ─── HELPERS ────────────────────────────────────────────────

function laneOptions(selectedId: string = ''): string {
  return store.listLanes().map(l =>
    `<option value="${l.id}" ${l.id === selectedId ? 'selected' : ''}>${l.name} (${l.status})</option>`
  ).join('')
}

function sessionForm(data: Partial<Session> = {}, action = '/sessions', method = 'POST', submitLabel = 'Create Session'): string {
  const lanes = store.listLanes()
  return `
    <form method="POST" action="${action}">
      ${method !== 'POST' ? `<input type="hidden" name="_method" value="${method}">` : ''}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="form-label">Session ID</label>
          <input type="text" name="id" value="${data.id || ''}" placeholder="e.g. HUB-17" ${data.id ? 'readonly style="opacity:0.5"' : ''}/>
        </div>
        <div>
          <label class="form-label">Title *</label>
          <input type="text" name="title" value="${data.title || ''}" placeholder="Short descriptive title" required/>
        </div>
        <div class="md:col-span-2">
          <label class="form-label">Objective *</label>
          <textarea name="objective" rows="2" placeholder="What this session must achieve">${data.objective || ''}</textarea>
        </div>
        <div>
          <label class="form-label">Lane *</label>
          <select name="lane_id" required>
            <option value="">— Select Lane —</option>
            ${laneOptions(data.lane_id)}
          </select>
        </div>
        <div>
          <label class="form-label">Status</label>
          <select name="status">
            ${['planned','active','partial','blocked','done','frozen','cancelled'].map(s =>
              `<option value="${s}" ${data.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Scope Type</label>
          <select name="scope_type">
            ${['tight','medium','wide'].map(s =>
              `<option value="${s}" ${data.scope_type === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Intensity (1=Light → 5=Extreme)</label>
          <select name="intensity_level">
            ${[1,2,3,4,5].map(i =>
              `<option value="${i}" ${Number(data.intensity_level) === i ? 'selected' : ''}>${i} — ${['Light','Medium','Heavy','Very Heavy','Extreme'][i-1]}</option>`
            ).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Planned Budget (BU)</label>
          <input type="number" name="planned_budget_unit" value="${data.planned_budget_unit ?? ''}" min="0" step="0.5" placeholder="0"/>
        </div>
        <div>
          <label class="form-label">Hard Cap (BU) *</label>
          <input type="number" name="hard_cap_budget_unit" value="${data.hard_cap_budget_unit ?? ''}" min="0" step="0.5" placeholder="0" required/>
        </div>
        <div>
          <label class="form-label">Actual Burn (BU)</label>
          <input type="number" name="actual_budget_unit" value="${data.actual_budget_unit ?? 0}" min="0" step="0.5"/>
        </div>
        <div>
          <label class="form-label">Blocker Type</label>
          <select name="blocker_type">
            ${['none','credential','external_access','technical','strategic','dependency','unknown'].map(b =>
              `<option value="${b}" ${data.blocker_type === b ? 'selected' : ''}>${b.replace('_',' ')}</option>`
            ).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Start Date</label>
          <input type="date" name="start_date" value="${data.start_date || ''}"/>
        </div>
        <div>
          <label class="form-label">End Date</label>
          <input type="date" name="end_date" value="${data.end_date || ''}"/>
        </div>
        <div>
          <label class="form-label">Owner</label>
          <input type="text" name="owner" value="${data.owner || 'Founder'}" placeholder="Founder"/>
        </div>
        <div class="md:col-span-2">
          <label class="form-label">Expected Output</label>
          <textarea name="expected_output" rows="2" placeholder="What success looks like">${data.expected_output || ''}</textarea>
        </div>
        <div class="md:col-span-2">
          <label class="form-label">Actual Output</label>
          <textarea name="actual_output" rows="2" placeholder="What was actually delivered">${data.actual_output || ''}</textarea>
        </div>
        <div class="md:col-span-2">
          <label class="form-label">Stop Condition</label>
          <input type="text" name="stop_condition" value="${data.stop_condition || ''}" placeholder="When should this session forcibly stop?"/>
        </div>
        <div class="md:col-span-2">
          <label class="form-label">Notes</label>
          <textarea name="notes" rows="2" placeholder="Any operational context or observations">${data.notes || ''}</textarea>
        </div>
        <div class="md:col-span-2">
          <label class="form-label">Evidence Links (one per line)</label>
          <textarea name="evidence_links" rows="2" placeholder="URLs or references to outputs/evidence">${(data.evidence_links || []).join('\n')}</textarea>
        </div>
      </div>
      <div class="flex gap-3 mt-6">
        <button type="submit" class="btn-primary">${submitLabel}</button>
        <a href="/sessions" class="btn-secondary">Cancel</a>
      </div>
    </form>
  `
}

// ─── ROUTES ─────────────────────────────────────────────────

// LIST
sessions.get('/', (c) => {
  const filter = c.req.query('status') || 'all'
  const allSessions = store.listSessions()
  const filtered = filter === 'all' ? allSessions : allSessions.filter(s => s.status === filter)

  const filterTabs = ['all','active','planned','partial','blocked','done','frozen','cancelled'].map(f =>
    `<a href="/sessions?status=${f}" class="px-3 py-1.5 rounded text-xs font-semibold ${filter === f ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}">${f.charAt(0).toUpperCase() + f.slice(1)}</a>`
  ).join('')

  const rows = filtered.length === 0
    ? `<tr><td colspan="7" class="text-center text-slate-500 py-8">No sessions found</td></tr>`
    : filtered.map(s => `
        <tr class="table-row hover:bg-slate-800/40">
          <td class="py-3 pr-4">
            <a href="/sessions/${s.id}" class="font-semibold text-blue-400 hover:text-blue-300">${s.id}</a>
          </td>
          <td class="py-3 pr-4">
            <div class="font-medium text-white text-sm">${s.title}</div>
            <div class="text-xs text-slate-500 truncate max-w-xs">${s.lane_name}</div>
          </td>
          <td class="py-3 pr-4">${statusBadge(s.status)}</td>
          <td class="py-3 pr-4" style="min-width:130px">
            <div class="text-xs text-slate-400 mb-1">${s.actual_budget_unit}/${s.hard_cap_budget_unit} BU (${s.burn_pct}%)</div>
            ${burnBar(s.burn_pct, s.cap_status)}
          </td>
          <td class="py-3 pr-4">${signalBadge(s.go_stop_signal)}</td>
          <td class="py-3 pr-4">${blockerBadge(s.blocker_type)}</td>
          <td class="py-3 text-xs text-slate-500">${s.start_date || '—'}</td>
        </tr>
      `).join('')

  const body = `
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-bold text-white">Sessions</h2>
          <p class="text-slate-500 text-sm mt-0.5">${allSessions.length} total sessions</p>
        </div>
        <a href="/sessions/new" class="btn-primary"><i class="fas fa-plus mr-1"></i>New Session</a>
      </div>

      <div class="flex gap-2 mb-4 flex-wrap">
        ${filterTabs}
      </div>

      <div class="card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="border-b border-slate-700">
            <tr class="text-left text-xs text-slate-500 uppercase">
              <th class="p-4 pb-3">ID</th>
              <th class="p-4 pb-3 pl-0">Session</th>
              <th class="p-4 pb-3 pl-0">Status</th>
              <th class="p-4 pb-3 pl-0">Budget</th>
              <th class="p-4 pb-3 pl-0">Signal</th>
              <th class="p-4 pb-3 pl-0">Blocker</th>
              <th class="p-4 pb-3 pl-0">Start</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800">
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `

  return c.html(shellHtml({ title: 'Sessions', activeNav: 'sessions', body }))
})

// NEW FORM
sessions.get('/new', (c) => {
  const body = `
    <div class="p-6 max-w-3xl">
      <div class="mb-6">
        <h2 class="text-xl font-bold text-white">New Session</h2>
        <p class="text-slate-500 text-sm mt-0.5">Create a new execution unit</p>
      </div>
      <div class="card p-6">
        ${sessionForm()}
      </div>
    </div>
  `
  return c.html(shellHtml({ title: 'New Session', activeNav: 'sessions', body }))
})

// CREATE
sessions.post('/', async (c) => {
  const form = await c.req.formData()
  const data: Partial<Session> = {
    id: (form.get('id') as string) || undefined,
    title: form.get('title') as string,
    lane_id: form.get('lane_id') as string,
    objective: form.get('objective') as string,
    scope_type: form.get('scope_type') as any,
    intensity_level: Number(form.get('intensity_level')) as any,
    planned_budget_unit: Number(form.get('planned_budget_unit')),
    hard_cap_budget_unit: Number(form.get('hard_cap_budget_unit')),
    actual_budget_unit: Number(form.get('actual_budget_unit')),
    status: form.get('status') as any,
    blocker_type: form.get('blocker_type') as any,
    expected_output: form.get('expected_output') as string,
    actual_output: form.get('actual_output') as string,
    start_date: form.get('start_date') as string,
    end_date: form.get('end_date') as string,
    owner: form.get('owner') as string,
    notes: form.get('notes') as string,
    stop_condition: form.get('stop_condition') as string,
    evidence_links: ((form.get('evidence_links') as string) || '').split('\n').filter(Boolean)
  }
  const session = store.createSession(data)
  return c.redirect(`/sessions/${session.id}`)
})

// DETAIL
sessions.get('/:id', (c) => {
  const id = c.req.param('id')
  const s = store.getSession(id)
  if (!s) return c.html(shellHtml({ title: '404', activeNav: 'sessions', body: '<div class="p-6 text-slate-400">Session not found.</div>' }), 404)

  const lane = store.getLane(s.lane_id)
  const decisions = store.listDecisions().filter(d => d.entity_id === s.id)

  const capColor = s.cap_status === 'exceeded' ? 'text-red-400' : s.cap_status === 'warning' ? 'text-yellow-400' : 'text-green-400'

  const evidenceHtml = s.evidence_links.length === 0
    ? '<span class="text-slate-500 text-xs">No evidence links</span>'
    : s.evidence_links.map(l => `<a href="${l}" class="text-blue-400 hover:text-blue-300 text-xs block truncate">${l}</a>`).join('')

  const decisionsHtml = decisions.length === 0
    ? '<div class="text-slate-500 text-sm py-2">No decisions for this session</div>'
    : decisions.map(d => `
        <div class="flex items-start gap-3 py-2 border-b border-slate-700 last:border-0 text-sm">
          <div class="mt-0.5 flex-shrink-0">
            ${(() => {
              const colors: Record<string, string> = { go:'#14532d:#86efac', stop:'#7f1d1d:#fca5a5', freeze:'#1e3a5f:#93c5fd', split:'#78350f:#fcd34d', continue:'#14532d:#86efac', escalate:'#7f1d1d:#fca5a5', defer:'#1f2937:#9ca3af', close:'#1f2937:#6b7280' }
              const [bg, fg] = (colors[d.decision_type] || '#1f2937:#9ca3af').split(':')
              return `<span style="background:${bg};color:${fg};font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:uppercase">${d.decision_type}</span>`
            })()}
          </div>
          <div class="flex-1">
            <p class="text-slate-300 text-xs">${d.reason}</p>
            <div class="text-xs text-slate-600 mt-1">${d.created_at.split('T')[0]} by ${d.created_by}</div>
          </div>
        </div>
      `).join('')

  const body = `
    <div class="p-6">
      <div class="flex items-start justify-between mb-6">
        <div>
          <div class="flex items-center gap-3 mb-1">
            <a href="/sessions" class="text-slate-500 hover:text-white text-sm">Sessions</a>
            <span class="text-slate-600">/</span>
            <span class="font-mono font-bold text-white">${s.id}</span>
            ${statusBadge(s.status)}
          </div>
          <h2 class="text-xl font-bold text-white">${s.title}</h2>
          <p class="text-slate-500 text-sm mt-0.5">${s.objective}</p>
        </div>
        <div class="flex gap-2 flex-shrink-0">
          ${signalBadge(s.go_stop_signal)}
          <a href="/sessions/${s.id}/edit" class="btn-secondary text-sm">Edit</a>
          <a href="/decisions/new?entity_type=session&entity_id=${s.id}" class="btn-primary text-sm">Log Decision</a>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <!-- Budget Card -->
        <div class="card p-4 md:col-span-2">
          <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Budget Status</h3>
          <div class="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div class="text-2xl font-bold text-blue-400">${s.planned_budget_unit}</div>
              <div class="text-xs text-slate-500 mt-0.5">Planned (BU)</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-yellow-400">${s.actual_budget_unit}</div>
              <div class="text-xs text-slate-500 mt-0.5">Actual Burn (BU)</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-red-400">${s.hard_cap_budget_unit}</div>
              <div class="text-xs text-slate-500 mt-0.5">Hard Cap (BU)</div>
            </div>
          </div>
          <div class="mb-2">${burnBar(s.burn_pct, s.cap_status)}</div>
          <div class="flex items-center justify-between text-xs">
            <span class="${capColor} font-semibold">${s.burn_pct}% of cap used</span>
            <span class="text-slate-500">Variance: ${s.variance > 0 ? '+' : ''}${s.variance} BU</span>
            <span class="${s.over_cap ? 'text-red-400 font-bold' : 'text-slate-500'}">${s.over_cap ? '⚠ OVER CAP' : 'Within cap'}</span>
          </div>
          ${s.over_cap ? `<div class="mt-3 text-xs text-red-400 font-semibold p-2 bg-red-950 rounded border border-red-800">STOP SIGNAL: Session has exceeded hard cap. Manual decision required.</div>` : ''}
          ${!s.over_cap && s.cap_status === 'warning' ? `<div class="mt-3 text-xs text-yellow-400 font-semibold p-2 bg-yellow-950 rounded border border-yellow-800">WATCH: Session approaching cap (${s.burn_pct}%). Monitor closely.</div>` : ''}
        </div>

        <!-- Meta Card -->
        <div class="card p-4">
          <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Session Meta</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between"><span class="text-slate-500">Lane</span><a href="/lanes/${s.lane_id}" class="text-blue-400 hover:text-blue-300">${s.lane_name}</a></div>
            <div class="flex justify-between"><span class="text-slate-500">Scope</span><span class="text-slate-300 capitalize">${s.scope_type}</span></div>
            <div class="flex justify-between items-center"><span class="text-slate-500">Intensity</span><span>${intensityDots(s.intensity_level)} <span class="text-xs text-slate-400 ml-1">${s.intensity_label}</span></span></div>
            <div class="flex justify-between"><span class="text-slate-500">Blocker</span>${blockerBadge(s.blocker_type)}</div>
            <div class="flex justify-between"><span class="text-slate-500">Owner</span><span class="text-slate-300">${s.owner}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Start</span><span class="text-slate-300">${s.start_date || '—'}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">End</span><span class="text-slate-300">${s.end_date || '—'}</span></div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div class="card p-4">
          <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Outputs</h3>
          <div class="mb-3">
            <div class="text-xs text-slate-500 mb-1">Expected</div>
            <p class="text-sm text-slate-300">${s.expected_output || '—'}</p>
          </div>
          <div>
            <div class="text-xs text-slate-500 mb-1">Actual</div>
            <p class="text-sm text-slate-300">${s.actual_output || '—'}</p>
          </div>
        </div>
        <div class="card p-4">
          <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Control Rules</h3>
          <div class="mb-3">
            <div class="text-xs text-slate-500 mb-1">Stop Condition</div>
            <p class="text-sm text-slate-300">${s.stop_condition || '—'}</p>
          </div>
          <div>
            <div class="text-xs text-slate-500 mb-1">Evidence Links</div>
            ${evidenceHtml}
          </div>
        </div>
      </div>

      ${s.notes ? `<div class="card p-4 mb-6"><h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Notes</h3><p class="text-sm text-slate-300">${s.notes}</p></div>` : ''}

      <!-- Quick Actions -->
      <div class="card p-4 mb-6">
        <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Quick Status Actions</h3>
        <div class="flex flex-wrap gap-2">
          ${['active','partial','blocked','done','frozen','cancelled'].map(st =>
            s.status === st ? '' :
            `<form method="POST" action="/sessions/${s.id}/status" style="display:inline">
              <input type="hidden" name="status" value="${st}"/>
              <button type="submit" class="${st === 'done' ? 'btn-primary' : st === 'blocked' || st === 'frozen' ? 'btn-warn' : st === 'cancelled' ? 'btn-danger' : 'btn-secondary'} text-xs">
                Mark ${st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            </form>`
          ).join('')}
        </div>
      </div>

      <!-- Decisions for this session -->
      <div class="card p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wide">Decision Log (this session)</h3>
          <a href="/decisions/new?entity_type=session&entity_id=${s.id}" class="text-blue-400 text-xs hover:text-blue-300">Log Decision →</a>
        </div>
        ${decisionsHtml}
      </div>
    </div>
  `

  return c.html(shellHtml({ title: s.id, activeNav: 'sessions', body }))
})

// EDIT FORM
sessions.get('/:id/edit', (c) => {
  const id = c.req.param('id')
  const s = store.getSession(id)
  if (!s) return c.redirect('/sessions')

  const body = `
    <div class="p-6 max-w-3xl">
      <div class="mb-6">
        <div class="flex items-center gap-3 mb-1">
          <a href="/sessions/${s.id}" class="text-slate-500 hover:text-white text-sm">← ${s.id}</a>
        </div>
        <h2 class="text-xl font-bold text-white">Edit Session</h2>
      </div>
      <div class="card p-6">
        ${sessionForm(s, `/sessions/${s.id}`, 'PUT', 'Save Changes')}
      </div>
      <div class="mt-4">
        <form method="POST" action="/sessions/${s.id}/delete" onsubmit="return confirm('Delete this session? This cannot be undone.')">
          <button type="submit" class="btn-danger text-sm"><i class="fas fa-trash mr-1"></i>Delete Session</button>
        </form>
      </div>
    </div>
  `
  return c.html(shellHtml({ title: `Edit ${s.id}`, activeNav: 'sessions', body }))
})

// UPDATE
sessions.post('/:id', async (c) => {
  const id = c.req.param('id')
  const form = await c.req.formData()
  const method = form.get('_method')
  if (method !== 'PUT') return c.redirect(`/sessions/${id}`)

  const data: Partial<Session> = {
    title: form.get('title') as string,
    lane_id: form.get('lane_id') as string,
    objective: form.get('objective') as string,
    scope_type: form.get('scope_type') as any,
    intensity_level: Number(form.get('intensity_level')) as any,
    planned_budget_unit: Number(form.get('planned_budget_unit')),
    hard_cap_budget_unit: Number(form.get('hard_cap_budget_unit')),
    actual_budget_unit: Number(form.get('actual_budget_unit')),
    status: form.get('status') as any,
    blocker_type: form.get('blocker_type') as any,
    expected_output: form.get('expected_output') as string,
    actual_output: form.get('actual_output') as string,
    start_date: form.get('start_date') as string,
    end_date: form.get('end_date') as string,
    owner: form.get('owner') as string,
    notes: form.get('notes') as string,
    stop_condition: form.get('stop_condition') as string,
    evidence_links: ((form.get('evidence_links') as string) || '').split('\n').filter(Boolean)
  }
  store.updateSession(id, data)
  return c.redirect(`/sessions/${id}`)
})

// QUICK STATUS UPDATE
sessions.post('/:id/status', async (c) => {
  const id = c.req.param('id')
  const form = await c.req.formData()
  const status = form.get('status') as any
  if (status) store.updateSession(id, { status })
  return c.redirect(`/sessions/${id}`)
})

// DELETE
sessions.post('/:id/delete', (c) => {
  const id = c.req.param('id')
  store.deleteSession(id)
  return c.redirect('/sessions')
})

// API
sessions.get('/api/list', (c) => {
  return c.json({ success: true, data: store.listSessions() })
})

export default sessions
