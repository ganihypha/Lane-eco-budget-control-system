// ============================================================
// IN-MEMORY STORE — Lane-Eco Budget Control System
// Simple in-memory persistence. Works without any external DB.
// Production upgrade path: swap to Cloudflare D1 or KV.
// ============================================================

import type {
  Session, Lane, Ecosystem, DecisionLog,
  SessionStatus, LaneHealth, EcosystemHealth,
  SessionWithComputed, LaneWithComputed, EcosystemWithComputed,
  DashboardData, RecommendedAction
} from './types'

// ─── SEED DATA ──────────────────────────────────────────────

const seedEcosystem: Ecosystem = {
  id: 'eco-001',
  period_label: 'Q2-2026',
  total_budget_cap: 200,
  total_budget_used: 0,
  active_lane_limit: 5,
  active_session_limit: 8,
  ecosystem_health: 'healthy',
  priority_order: [],
  freeze_rules: 'Freeze new sessions when total_budget_used > 80% of cap OR active_lanes > limit',
  notes: 'Initial ecosystem period',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}

const seedLanes: Lane[] = [
  {
    id: 'lane-001',
    name: 'Sovereign Tower',
    category: 'Infrastructure',
    primary_goal: 'Build and maintain Sovereign Tower internal operating platform',
    status: 'active',
    max_session_count: 20,
    planned_budget_unit: 80,
    hard_cap_budget_unit: 100,
    actual_budget_unit: 42,
    lane_health: 'healthy',
    exit_criteria: 'All modules live, auth stable, governance queue operational',
    owner: 'Founder',
    notes: 'HUB-15 completed. HUB-16 = Budget Controller build.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'lane-002',
    name: 'BarberKas',
    category: 'Product',
    primary_goal: 'Revenue-generating product lane for barbershop management',
    status: 'planned',
    max_session_count: 15,
    planned_budget_unit: 60,
    hard_cap_budget_unit: 80,
    actual_budget_unit: 0,
    lane_health: 'healthy',
    exit_criteria: 'MVP live, first paying customer onboarded',
    owner: 'Founder',
    notes: 'Post-Sovereign Tower priority',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

const seedSessions: Session[] = [
  {
    id: 'HUB-16',
    title: 'Budget Controller Greenfield Build',
    lane_id: 'lane-001',
    objective: 'Build MVP Lane-Eco Budget Control System — session/lane/ecosystem budget management',
    scope_type: 'tight',
    intensity_level: 3,
    planned_budget_unit: 8,
    hard_cap_budget_unit: 10,
    actual_budget_unit: 3,
    status: 'active',
    blocker_type: 'none',
    expected_output: 'Running Budget Controller app with Dashboard, Session, Lane, Ecosystem, Decision Log modules',
    actual_output: 'In progress',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    owner: 'Founder',
    notes: 'Master Architect prompt executed. Greenfield build.',
    stop_condition: 'All 5 modules functional and BUILD-VERIFIED',
    evidence_links: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'HUB-15',
    title: 'Sovereign Tower HUB-14 Completion + Deploy Finalization',
    lane_id: 'lane-001',
    objective: 'Sync HUB-14 archive to canonical repo, verify build, push to GitHub/Cloudflare',
    scope_type: 'tight',
    intensity_level: 2,
    planned_budget_unit: 6,
    hard_cap_budget_unit: 8,
    actual_budget_unit: 5,
    status: 'partial',
    blocker_type: 'credential',
    expected_output: 'HUB-14 live on production, Supabase migration applied',
    actual_output: 'BUILD-VERIFIED local. GitHub + Cloudflare auth blocked.',
    start_date: '2026-04-14',
    end_date: '2026-04-14',
    owner: 'Founder',
    notes: 'Blocked by: GitHub auth, Cloudflare API token, Supabase credentials',
    stop_condition: 'Deploy live or 8 BU cap reached',
    evidence_links: [],
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'HUB-14',
    title: 'Chamber Console v1.2 Persistence Hardening',
    lane_id: 'lane-001',
    objective: 'Add Supabase governance queue persistence to Chamber Console',
    scope_type: 'tight',
    intensity_level: 3,
    planned_budget_unit: 8,
    hard_cap_budget_unit: 10,
    actual_budget_unit: 8,
    status: 'partial',
    blocker_type: 'credential',
    expected_output: 'Supabase persistence live for governance queue',
    actual_output: 'BUILD-VERIFIED. Fallback mode active. Supabase BLOCKED.',
    start_date: '2026-04-13',
    end_date: '2026-04-13',
    owner: 'Founder',
    notes: 'Code complete. Missing Supabase credentials for live persistence.',
    stop_condition: 'All Chamber routes live with Supabase persistence',
    evidence_links: [],
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 172800000).toISOString()
  }
]

const seedDecisions: DecisionLog[] = [
  {
    id: 'dec-001',
    entity_type: 'session',
    entity_id: 'HUB-14',
    decision_type: 'stop',
    reason: 'Supabase credentials not available this session. BUILD-VERIFIED status. Defer live persistence to next session.',
    created_at: new Date(Date.now() - 172800000).toISOString(),
    created_by: 'Founder'
  },
  {
    id: 'dec-002',
    entity_type: 'session',
    entity_id: 'HUB-15',
    decision_type: 'stop',
    reason: 'GitHub auth + Cloudflare deploy BLOCKED. HUB-14 code synced and BUILD-VERIFIED. Cannot finalize without credentials.',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    created_by: 'Founder'
  },
  {
    id: 'dec-003',
    entity_type: 'session',
    entity_id: 'HUB-16',
    decision_type: 'go',
    reason: 'Budget Controller MVP required before BarberKas launch. Greenfield build approved. Scope locked: tight.',
    created_at: new Date().toISOString(),
    created_by: 'Founder'
  }
]

// ─── STORE ──────────────────────────────────────────────────

class BudgetStore {
  private sessions: Map<string, Session> = new Map()
  private lanes: Map<string, Lane> = new Map()
  private ecosystem: Ecosystem = { ...seedEcosystem }
  private decisions: DecisionLog[] = [...seedDecisions]
  private decisionCounter = seedDecisions.length + 1

  constructor() {
    // Load seed data
    seedLanes.forEach(l => this.lanes.set(l.id, { ...l }))
    seedSessions.forEach(s => this.sessions.set(s.id, { ...s }))
    this.syncEcosystemBudget()
  }

  // ── ECOSYSTEM SYNC ────────────────────────────────────────

  private syncEcosystemBudget() {
    let used = 0
    this.sessions.forEach(s => {
      if (!['cancelled'].includes(s.status)) {
        used += s.actual_budget_unit
      }
    })
    this.ecosystem.total_budget_used = used
    this.ecosystem.ecosystem_health = this.computeEcoHealth()
    this.ecosystem.updated_at = new Date().toISOString()
  }

  private syncLaneBudget(laneId: string) {
    const lane = this.lanes.get(laneId)
    if (!lane) return
    let used = 0
    this.sessions.forEach(s => {
      if (s.lane_id === laneId && !['cancelled'].includes(s.status)) {
        used += s.actual_budget_unit
      }
    })
    lane.actual_budget_unit = used
    lane.lane_health = this.computeLaneHealth(lane)
    lane.updated_at = new Date().toISOString()
    this.syncEcosystemBudget()
  }

  private computeLaneHealth(lane: Lane): LaneHealth {
    const pct = lane.hard_cap_budget_unit > 0
      ? (lane.actual_budget_unit / lane.hard_cap_budget_unit) * 100
      : 0
    const sessionCount = Array.from(this.sessions.values())
      .filter(s => s.lane_id === lane.id && !['cancelled', 'done'].includes(s.status)).length
    
    if (pct >= 100 || lane.status === 'blocked') return 'frozen'
    if (pct >= 85 || sessionCount >= lane.max_session_count * 0.9) return 'overloaded'
    if (pct >= 65 || sessionCount >= lane.max_session_count * 0.7) return 'watch'
    return 'healthy'
  }

  private computeEcoHealth(): EcosystemHealth {
    const pct = this.ecosystem.total_budget_cap > 0
      ? (this.ecosystem.total_budget_used / this.ecosystem.total_budget_cap) * 100
      : 0
    const activeLanes = Array.from(this.lanes.values()).filter(l => l.status === 'active').length
    const activeSessions = Array.from(this.sessions.values()).filter(s => s.status === 'active').length

    if (pct >= 100 || activeLanes >= this.ecosystem.active_lane_limit * 1.2) return 'frozen'
    if (pct >= 85 || activeLanes > this.ecosystem.active_lane_limit) return 'overloaded'
    if (pct >= 65 || activeSessions >= this.ecosystem.active_session_limit * 0.8) return 'constrained'
    return 'healthy'
  }

  // ── COMPUTED HELPERS ──────────────────────────────────────

  computeSession(s: Session): SessionWithComputed {
    const cap = s.hard_cap_budget_unit
    const burn_pct = cap > 0 ? Math.round((s.actual_budget_unit / cap) * 100) : 0
    const over_cap = s.actual_budget_unit > cap
    const cap_status = over_cap ? 'exceeded' : burn_pct >= 80 ? 'warning' : 'safe'
    const go_stop_signal = over_cap || s.status === 'blocked' || s.blocker_type !== 'none'
      ? 'STOP'
      : burn_pct >= 80 ? 'WATCH' : 'GO'
    const intensityLabels = { 1: 'Light', 2: 'Medium', 3: 'Heavy', 4: 'Very Heavy', 5: 'Premium/Extreme' }
    const lane = this.lanes.get(s.lane_id)

    return {
      ...s,
      lane_name: lane?.name || 'Unknown Lane',
      burn_pct,
      variance: s.planned_budget_unit - s.actual_budget_unit,
      over_cap,
      cap_status,
      go_stop_signal,
      intensity_label: intensityLabels[s.intensity_level] || 'Unknown'
    }
  }

  computeLane(l: Lane): LaneWithComputed {
    const sessions = Array.from(this.sessions.values()).filter(s => s.lane_id === l.id)
    const activeSessions = sessions.filter(s => s.status === 'active')
    const blockedSessions = sessions.filter(s => s.status === 'blocked' || s.blocker_type !== 'none')
    const burn_pct = l.hard_cap_budget_unit > 0
      ? Math.round((l.actual_budget_unit / l.hard_cap_budget_unit) * 100)
      : 0

    return {
      ...l,
      session_count: sessions.length,
      active_session_count: activeSessions.length,
      blocked_session_count: blockedSessions.length,
      burn_pct,
      over_cap: l.actual_budget_unit > l.hard_cap_budget_unit,
      sessions
    }
  }

  computeEcosystem(): EcosystemWithComputed {
    const activeLanes = Array.from(this.lanes.values()).filter(l => l.status === 'active').length
    const activeSessions = Array.from(this.sessions.values()).filter(s => s.status === 'active').length
    const overloadedLanes = Array.from(this.lanes.values()).filter(l => l.lane_health === 'overloaded' || l.lane_health === 'frozen').length
    const blockedSessions = Array.from(this.sessions.values()).filter(s => s.status === 'blocked' || s.blocker_type !== 'none').length
    const pressure_pct = this.ecosystem.total_budget_cap > 0
      ? Math.round((this.ecosystem.total_budget_used / this.ecosystem.total_budget_cap) * 100)
      : 0

    return {
      ...this.ecosystem,
      active_lanes: activeLanes,
      active_sessions: activeSessions,
      budget_remaining: this.ecosystem.total_budget_cap - this.ecosystem.total_budget_used,
      pressure_pct,
      overloaded_lanes: overloadedLanes,
      blocked_sessions: blockedSessions
    }
  }

  // ── DASHBOARD ─────────────────────────────────────────────

  getDashboard(): DashboardData {
    const ecosystem = this.computeEcosystem()
    const allSessions = Array.from(this.sessions.values()).map(s => this.computeSession(s))
    const allLanes = Array.from(this.lanes.values()).map(l => this.computeLane(l))

    const active_sessions = allSessions.filter(s => s.status === 'active')
    const active_lanes = allLanes.filter(l => l.status === 'active')
    const blocked_sessions = allSessions.filter(s => s.status === 'blocked' || (s.blocker_type !== 'none' && s.status !== 'done' && s.status !== 'cancelled'))
    const overloaded_lanes = allLanes.filter(l => l.lane_health === 'overloaded' || l.lane_health === 'frozen')
    const recent_decisions = [...this.decisions].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5)

    const recommended_actions: RecommendedAction[] = []

    // Rule: blocked sessions need resolution
    blocked_sessions.forEach(s => {
      if (s.status !== 'done' && s.status !== 'cancelled') {
        recommended_actions.push({
          priority: 'high',
          entity_type: 'session',
          entity_id: s.id,
          entity_name: s.title,
          action: 'RESOLVE BLOCKER',
          reason: `Session blocked: ${s.blocker_type}. Stop or escalate.`
        })
      }
    })

    // Rule: overloaded lanes
    overloaded_lanes.forEach(l => {
      recommended_actions.push({
        priority: 'high',
        entity_type: 'lane',
        entity_id: l.id,
        entity_name: l.name,
        action: 'FREEZE OR REDUCE',
        reason: `Lane ${l.lane_health} at ${l.burn_pct}% capacity. Consider maintenance mode.`
      })
    })

    // Rule: over-cap sessions
    allSessions.filter(s => s.over_cap && !['done','cancelled','frozen'].includes(s.status)).forEach(s => {
      recommended_actions.push({
        priority: 'high',
        entity_type: 'session',
        entity_id: s.id,
        entity_name: s.title,
        action: 'STOP NOW',
        reason: `Session exceeded hard cap (${s.actual_budget_unit}/${s.hard_cap_budget_unit} BU). Stop required.`
      })
    })

    // Rule: ecosystem pressure
    if (ecosystem.pressure_pct >= 80) {
      recommended_actions.push({
        priority: 'high',
        entity_type: 'ecosystem',
        entity_id: ecosystem.id,
        entity_name: ecosystem.period_label,
        action: 'ECOSYSTEM REVIEW',
        reason: `Ecosystem at ${ecosystem.pressure_pct}% budget pressure. Freeze new sessions.`
      })
    }

    // Rule: sessions at warning level
    allSessions.filter(s => s.cap_status === 'warning' && s.status === 'active').forEach(s => {
      recommended_actions.push({
        priority: 'medium',
        entity_type: 'session',
        entity_id: s.id,
        entity_name: s.title,
        action: 'WATCH',
        reason: `Session at ${s.burn_pct}% of hard cap. Monitor closely.`
      })
    })

    return {
      ecosystem,
      active_sessions,
      active_lanes,
      blocked_sessions,
      overloaded_lanes,
      recent_decisions,
      recommended_actions: recommended_actions.sort((a, b) => {
        const p = { high: 0, medium: 1, low: 2 }
        return p[a.priority] - p[b.priority]
      })
    }
  }

  // ── SESSIONS CRUD ─────────────────────────────────────────

  listSessions(): SessionWithComputed[] {
    return Array.from(this.sessions.values())
      .map(s => this.computeSession(s))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  getSession(id: string): SessionWithComputed | null {
    const s = this.sessions.get(id)
    return s ? this.computeSession(s) : null
  }

  createSession(data: Partial<Session>): SessionWithComputed {
    const now = new Date().toISOString()
    const id = data.id || `SES-${Date.now()}`
    const session: Session = {
      id,
      title: data.title || 'Untitled Session',
      lane_id: data.lane_id || '',
      objective: data.objective || '',
      scope_type: data.scope_type || 'medium',
      intensity_level: data.intensity_level || 2,
      planned_budget_unit: Number(data.planned_budget_unit) || 0,
      hard_cap_budget_unit: Number(data.hard_cap_budget_unit) || 0,
      actual_budget_unit: Number(data.actual_budget_unit) || 0,
      status: data.status || 'planned',
      blocker_type: data.blocker_type || 'none',
      expected_output: data.expected_output || '',
      actual_output: data.actual_output || '',
      start_date: data.start_date || now.split('T')[0],
      end_date: data.end_date || '',
      owner: data.owner || 'Founder',
      notes: data.notes || '',
      stop_condition: data.stop_condition || '',
      evidence_links: data.evidence_links || [],
      created_at: now,
      updated_at: now
    }
    this.sessions.set(id, session)
    if (session.lane_id) this.syncLaneBudget(session.lane_id)
    return this.computeSession(session)
  }

  updateSession(id: string, data: Partial<Session>): SessionWithComputed | null {
    const existing = this.sessions.get(id)
    if (!existing) return null
    const prevLaneId = existing.lane_id
    const updated: Session = { ...existing, ...data, id, updated_at: new Date().toISOString() }
    this.sessions.set(id, updated)
    if (prevLaneId) this.syncLaneBudget(prevLaneId)
    if (data.lane_id && data.lane_id !== prevLaneId) this.syncLaneBudget(data.lane_id)
    return this.computeSession(updated)
  }

  deleteSession(id: string): boolean {
    const s = this.sessions.get(id)
    if (!s) return false
    this.sessions.delete(id)
    if (s.lane_id) this.syncLaneBudget(s.lane_id)
    return true
  }

  // ── LANES CRUD ────────────────────────────────────────────

  listLanes(): LaneWithComputed[] {
    return Array.from(this.lanes.values())
      .map(l => this.computeLane(l))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  getLane(id: string): LaneWithComputed | null {
    const l = this.lanes.get(id)
    return l ? this.computeLane(l) : null
  }

  createLane(data: Partial<Lane>): LaneWithComputed {
    const now = new Date().toISOString()
    const id = data.id || `lane-${Date.now()}`
    const lane: Lane = {
      id,
      name: data.name || 'Untitled Lane',
      category: data.category || 'General',
      primary_goal: data.primary_goal || '',
      status: data.status || 'planned',
      max_session_count: Number(data.max_session_count) || 10,
      planned_budget_unit: Number(data.planned_budget_unit) || 0,
      hard_cap_budget_unit: Number(data.hard_cap_budget_unit) || 0,
      actual_budget_unit: 0,
      lane_health: 'healthy',
      exit_criteria: data.exit_criteria || '',
      owner: data.owner || 'Founder',
      notes: data.notes || '',
      created_at: now,
      updated_at: now
    }
    this.lanes.set(id, lane)
    this.syncEcosystemBudget()
    return this.computeLane(lane)
  }

  updateLane(id: string, data: Partial<Lane>): LaneWithComputed | null {
    const existing = this.lanes.get(id)
    if (!existing) return null
    const updated: Lane = { ...existing, ...data, id, updated_at: new Date().toISOString() }
    // Recompute health after update
    updated.lane_health = this.computeLaneHealth(updated)
    this.lanes.set(id, updated)
    this.syncEcosystemBudget()
    return this.computeLane(updated)
  }

  deleteLane(id: string): boolean {
    if (!this.lanes.has(id)) return false
    this.lanes.delete(id)
    this.syncEcosystemBudget()
    return true
  }

  // ── ECOSYSTEM ─────────────────────────────────────────────

  getEcosystem(): EcosystemWithComputed {
    return this.computeEcosystem()
  }

  updateEcosystem(data: Partial<Ecosystem>): EcosystemWithComputed {
    this.ecosystem = { ...this.ecosystem, ...data, updated_at: new Date().toISOString() }
    this.syncEcosystemBudget()
    return this.computeEcosystem()
  }

  // ── DECISIONS ─────────────────────────────────────────────

  listDecisions(): DecisionLog[] {
    return [...this.decisions].sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  createDecision(data: Partial<DecisionLog>): DecisionLog {
    const decision: DecisionLog = {
      id: `dec-${String(this.decisionCounter++).padStart(3, '0')}`,
      entity_type: data.entity_type || 'session',
      entity_id: data.entity_id || '',
      decision_type: data.decision_type || 'continue',
      reason: data.reason || '',
      created_at: new Date().toISOString(),
      created_by: data.created_by || 'Founder'
    }
    this.decisions.push(decision)
    return decision
  }

  // ── UTILS ─────────────────────────────────────────────────

  getLanesMap(): Map<string, Lane> {
    return this.lanes
  }
}

// Singleton store instance
export const store = new BudgetStore()
