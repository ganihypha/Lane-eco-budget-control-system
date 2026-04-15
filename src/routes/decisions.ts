// ============================================================
// DECISIONS ROUTE — Lane-Eco Budget Control System
// Decision Log: historical record of all control decisions
// ============================================================

import { Hono } from 'hono'
import { store } from '../lib/store'
import { shellHtml, decisionBadge } from '../lib/ui'
import type { DecisionLog } from '../lib/types'

const decisions = new Hono()

// ─── LIST ───────────────────────────────────────────────────

decisions.get('/', (c) => {
  const filter = c.req.query('type') || 'all'
  const entityFilter = c.req.query('entity') || 'all'
  
  let all = store.listDecisions()
  if (filter !== 'all') all = all.filter(d => d.decision_type === filter)
  if (entityFilter !== 'all') all = all.filter(d => d.entity_type === entityFilter)

  const typeTabs = ['all','go','stop','freeze','split','continue','escalate','defer','close'].map(t =>
    `<a href="/decisions?type=${t}&entity=${entityFilter}" class="px-3 py-1.5 rounded text-xs font-semibold ${filter === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}">${t.charAt(0).toUpperCase() + t.slice(1)}</a>`
  ).join('')

  const entityTabs = ['all','session','lane','ecosystem'].map(e =>
    `<a href="/decisions?type=${filter}&entity=${e}" class="px-3 py-1.5 rounded text-xs font-semibold ${entityFilter === e ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}">${e.charAt(0).toUpperCase() + e.slice(1)}</a>`
  ).join('')

  const rows = all.length === 0
    ? `<div class="text-slate-500 text-sm py-8 text-center">No decisions found</div>`
    : all.map(d => {
        const entityLink = d.entity_type === 'session' ? `/sessions/${d.entity_id}` : d.entity_type === 'lane' ? `/lanes/${d.entity_id}` : '/ecosystem'
        return `
          <div class="flex items-start gap-4 py-4 border-b border-slate-800 last:border-0 hover:bg-slate-800/20 px-2 rounded">
            <div class="flex-shrink-0 mt-0.5">${decisionBadge(d.decision_type)}</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs text-slate-500 uppercase font-semibold">${d.entity_type}</span>
                <a href="${entityLink}" class="text-blue-400 hover:text-blue-300 text-xs font-mono">${d.entity_id}</a>
              </div>
              <p class="text-sm text-slate-300">${d.reason}</p>
              <div class="text-xs text-slate-600 mt-1">${d.created_at.replace('T', ' ').split('.')[0]} · by ${d.created_by}</div>
            </div>
            <div class="flex-shrink-0 text-xs text-slate-600">${d.id}</div>
          </div>
        `
      }).join('')

  // Decision type summary
  const allDecisions = store.listDecisions()
  const typeCounts: Record<string, number> = {}
  allDecisions.forEach(d => { typeCounts[d.decision_type] = (typeCounts[d.decision_type] || 0) + 1 })

  const summaryCards = `
    <div class="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
      ${['go','stop','freeze','escalate','defer','close'].map(t => `
        <div class="card p-3 text-center">
          <div class="text-xl font-bold text-white">${typeCounts[t] || 0}</div>
          <div class="mt-1">${decisionBadge(t)}</div>
        </div>
      `).join('')}
    </div>
  `

  const body = `
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-bold text-white">Decision Log</h2>
          <p class="text-slate-500 text-sm mt-0.5">${allDecisions.length} total decisions · the why behind every control action</p>
        </div>
        <a href="/decisions/new" class="btn-primary"><i class="fas fa-gavel mr-1"></i>Log Decision</a>
      </div>

      ${summaryCards}

      <div class="flex gap-2 mb-2 flex-wrap">
        <span class="text-xs text-slate-500 self-center mr-1">Type:</span>
        ${typeTabs}
      </div>
      <div class="flex gap-2 mb-4 flex-wrap">
        <span class="text-xs text-slate-500 self-center mr-1">Entity:</span>
        ${entityTabs}
      </div>

      <div class="card p-4">
        ${rows}
      </div>
    </div>
  `
  return c.html(shellHtml({ title: 'Decision Log', activeNav: 'decisions', body }))
})

// ─── NEW FORM ────────────────────────────────────────────────

decisions.get('/new', (c) => {
  const prefillType = c.req.query('entity_type') || ''
  const prefillId = c.req.query('entity_id') || ''

  const allSessions = store.listSessions()
  const allLanes = store.listLanes()

  const sessionOptions = allSessions.map(s =>
    `<option value="${s.id}" ${prefillId === s.id ? 'selected' : ''}>${s.id}: ${s.title}</option>`
  ).join('')
  const laneOptions = allLanes.map(l =>
    `<option value="${l.id}" ${prefillId === l.id ? 'selected' : ''}>${l.name}</option>`
  ).join('')
  const eco = store.getEcosystem()

  const body = `
    <div class="p-6 max-w-2xl">
      <div class="mb-6">
        <h2 class="text-xl font-bold text-white">Log a Decision</h2>
        <p class="text-slate-500 text-sm mt-0.5">Record a control decision with its reasoning</p>
      </div>
      <div class="card p-6">
        <form method="POST" action="/decisions">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="form-label">Entity Type *</label>
              <select name="entity_type" id="entityType" onchange="updateEntitySelect(this.value)">
                ${['session','lane','ecosystem'].map(t =>
                  `<option value="${t}" ${prefillType === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`
                ).join('')}
              </select>
            </div>
            <div>
              <label class="form-label">Decision Type *</label>
              <select name="decision_type">
                ${['go','stop','freeze','split','continue','escalate','defer','close'].map(d =>
                  `<option value="${d}">${d.charAt(0).toUpperCase() + d.slice(1)}</option>`
                ).join('')}
              </select>
            </div>
            
            <!-- Entity ID selectors -->
            <div class="md:col-span-2" id="sessionSelector" style="${prefillType === 'lane' || prefillType === 'ecosystem' ? 'display:none' : ''}">
              <label class="form-label">Session *</label>
              <select name="session_entity_id">
                <option value="">— Select Session —</option>
                ${sessionOptions}
              </select>
            </div>
            <div class="md:col-span-2" id="laneSelector" style="${prefillType !== 'lane' ? 'display:none' : ''}">
              <label class="form-label">Lane *</label>
              <select name="lane_entity_id">
                <option value="">— Select Lane —</option>
                ${laneOptions}
              </select>
            </div>
            <div class="md:col-span-2" id="ecoSelector" style="${prefillType !== 'ecosystem' ? 'display:none' : ''}">
              <label class="form-label">Ecosystem</label>
              <input type="text" value="${eco.period_label}" readonly style="opacity:0.5"/>
              <input type="hidden" name="eco_entity_id" value="${eco.id}"/>
            </div>

            <div class="md:col-span-2">
              <label class="form-label">Reason / Justification *</label>
              <textarea name="reason" rows="4" placeholder="Why was this decision made? What evidence supports it? What is the expected outcome?" required></textarea>
            </div>
            <div>
              <label class="form-label">Decided By</label>
              <input type="text" name="created_by" value="Founder" placeholder="Founder"/>
            </div>
          </div>
          <div class="flex gap-3 mt-6">
            <button type="submit" class="btn-primary"><i class="fas fa-gavel mr-1"></i>Log Decision</button>
            <a href="/decisions" class="btn-secondary">Cancel</a>
          </div>
        </form>
      </div>
    </div>
    <script>
      function updateEntitySelect(type) {
        document.getElementById('sessionSelector').style.display = type === 'session' ? '' : 'none'
        document.getElementById('laneSelector').style.display = type === 'lane' ? '' : 'none'
        document.getElementById('ecoSelector').style.display = type === 'ecosystem' ? '' : 'none'
      }
    </script>
  `
  return c.html(shellHtml({ title: 'Log Decision', activeNav: 'decisions', body }))
})

// ─── CREATE ──────────────────────────────────────────────────

decisions.post('/', async (c) => {
  const form = await c.req.formData()
  const entityType = form.get('entity_type') as any
  let entityId = ''
  if (entityType === 'session') entityId = form.get('session_entity_id') as string
  else if (entityType === 'lane') entityId = form.get('lane_entity_id') as string
  else if (entityType === 'ecosystem') entityId = form.get('eco_entity_id') as string

  const data: Partial<DecisionLog> = {
    entity_type: entityType,
    entity_id: entityId,
    decision_type: form.get('decision_type') as any,
    reason: form.get('reason') as string,
    created_by: (form.get('created_by') as string) || 'Founder'
  }
  store.createDecision(data)

  // Redirect back to entity detail if possible
  if (entityType === 'session' && entityId) return c.redirect(`/sessions/${entityId}`)
  if (entityType === 'lane' && entityId) return c.redirect(`/lanes/${entityId}`)
  if (entityType === 'ecosystem') return c.redirect('/ecosystem')
  return c.redirect('/decisions')
})

export default decisions
