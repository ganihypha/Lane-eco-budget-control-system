// ============================================================
// DOMAIN TYPES — Lane-Eco Budget Control System
// Internal operational tool for session/lane/ecosystem budget mgmt
// ============================================================

// ─── ENUMS ──────────────────────────────────────────────────

export type ScopeType = 'tight' | 'medium' | 'wide'
export type IntensityLevel = 1 | 2 | 3 | 4 | 5
export type SessionStatus = 'planned' | 'active' | 'partial' | 'blocked' | 'done' | 'frozen' | 'cancelled'
export type BlockerType = 'none' | 'credential' | 'external_access' | 'technical' | 'strategic' | 'dependency' | 'unknown'
export type LaneStatus = 'planned' | 'active' | 'maintenance' | 'blocked' | 'closed'
export type LaneHealth = 'healthy' | 'watch' | 'overloaded' | 'frozen'
export type EcosystemHealth = 'healthy' | 'constrained' | 'overloaded' | 'frozen'
export type DecisionType = 'go' | 'stop' | 'freeze' | 'split' | 'continue' | 'escalate' | 'defer' | 'close'
export type EntityType = 'session' | 'lane' | 'ecosystem'

// ─── SESSION ────────────────────────────────────────────────

export interface Session {
  id: string
  title: string
  lane_id: string
  objective: string
  scope_type: ScopeType
  intensity_level: IntensityLevel
  planned_budget_unit: number
  hard_cap_budget_unit: number
  actual_budget_unit: number
  status: SessionStatus
  blocker_type: BlockerType
  expected_output: string
  actual_output: string
  start_date: string
  end_date: string
  owner: string
  notes: string
  stop_condition: string
  evidence_links: string[]
  created_at: string
  updated_at: string
}

// ─── LANE ───────────────────────────────────────────────────

export interface Lane {
  id: string
  name: string
  category: string
  primary_goal: string
  status: LaneStatus
  max_session_count: number
  planned_budget_unit: number
  hard_cap_budget_unit: number
  actual_budget_unit: number
  lane_health: LaneHealth
  exit_criteria: string
  owner: string
  notes: string
  created_at: string
  updated_at: string
}

// ─── ECOSYSTEM ──────────────────────────────────────────────

export interface Ecosystem {
  id: string
  period_label: string
  total_budget_cap: number
  total_budget_used: number
  active_lane_limit: number
  active_session_limit: number
  ecosystem_health: EcosystemHealth
  priority_order: string[]
  freeze_rules: string
  notes: string
  created_at: string
  updated_at: string
}

// ─── DECISION LOG ───────────────────────────────────────────

export interface DecisionLog {
  id: string
  entity_type: EntityType
  entity_id: string
  decision_type: DecisionType
  reason: string
  created_at: string
  created_by: string
}

// ─── COMPUTED / UI TYPES ────────────────────────────────────

export interface SessionWithComputed extends Session {
  lane_name?: string
  burn_pct: number        // actual / hard_cap * 100
  variance: number        // planned - actual
  over_cap: boolean       // actual > hard_cap
  cap_status: 'safe' | 'warning' | 'exceeded'
  go_stop_signal: 'GO' | 'WATCH' | 'STOP'
  intensity_label: string
}

export interface LaneWithComputed extends Lane {
  session_count: number
  active_session_count: number
  blocked_session_count: number
  burn_pct: number
  over_cap: boolean
  sessions?: Session[]
}

export interface EcosystemWithComputed extends Ecosystem {
  active_lanes: number
  active_sessions: number
  budget_remaining: number
  pressure_pct: number
  overloaded_lanes: number
  blocked_sessions: number
}

export interface DashboardData {
  ecosystem: EcosystemWithComputed
  active_sessions: SessionWithComputed[]
  active_lanes: LaneWithComputed[]
  blocked_sessions: SessionWithComputed[]
  overloaded_lanes: LaneWithComputed[]
  recent_decisions: DecisionLog[]
  recommended_actions: RecommendedAction[]
}

export interface RecommendedAction {
  priority: 'high' | 'medium' | 'low'
  entity_type: EntityType
  entity_id: string
  entity_name: string
  action: string
  reason: string
}

// ─── API RESPONSE ───────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: { code: string; message: string }
  meta?: { total?: number; page?: number }
}
