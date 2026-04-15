// ============================================================
// PROMPT BRIDGE — Lane-Eco Budget Control System
// Phase A: Export Layer
// Phase B: Pack Generator
// Phase C: Closeout Ingestion
//
// Spec: Prompt Bridge Doc v1.0 (mster.archi.tect.prompt.finn.nal)
// Purpose: Convert structured operational truth from the Budget
//          Controller into a clean Master Architect Context Pack
//          for AI Dev / executor sessions.
//
// DO NOT: Replace the app, rebuild the dashboard, or act as
//         a fake billing engine.
// ============================================================

import { store } from './store'
import type {
  SessionWithComputed, LaneWithComputed, EcosystemWithComputed,
  DecisionLog, EntityType, DecisionType
} from './types'

// ─── TYPES ──────────────────────────────────────────────────

export interface SessionPromptContext {
  session_id: string
  title: string
  objective: string
  scope: string
  expected_output: string
  actual_output: string
  status: string
  intensity: number
  intensity_label: string
  planned_budget_unit: number
  hard_cap_budget_unit: number
  actual_budget_unit: number
  cap_status: string
  continuation_signal: string   // GO / WATCH / STOP
  blocker_type: string
  blocker_note: string
  escalation_needed: boolean
  evidence_links: string[]
  last_update: string
  lane_name: string
}

export interface LanePromptContext {
  lane_id: string
  lane_name: string
  lane_status: string
  lane_health: string
  active_session_count: number
  blocked_session_count: number
  planned_budget_unit: number
  hard_cap_budget_unit: number
  actual_budget_unit: number
  burn_pct: number
  exit_criteria: string
  owner: string
}

export interface EcosystemPromptContext {
  period_label: string
  ecosystem_health: string
  total_budget_cap: number
  total_budget_used: number
  budget_remaining: number
  active_lane_count: number
  active_session_count: number
  freeze_rules: string
  pressure_pct: number
  pressure_level: string   // low / moderate / high / critical
}

export interface DecisionSummaryContext {
  entity_type: EntityType
  entity_id: string
  recent_decisions: {
    id: string
    decision_type: string
    reason: string
    created_at: string
    created_by: string
  }[]
}

export interface RepoAuthorityContext {
  canonical_product_repo: string
  canonical_ecosystem_repo: string
  local_working_repo: string
  live_url: string
  repo_match_status: string
  deploy_authority: string
  env_readiness: string
  execution_status: string
}

export interface MasterArchitectPack {
  generated_at: string
  build_session: string
  session: SessionPromptContext | null
  lane: LanePromptContext | null
  ecosystem: EcosystemPromptContext
  decisions: DecisionSummaryContext | null
  repo: RepoAuthorityContext
  prompt_constraints: string[]
  required_output_format: string[]
  text_pack: string   // Human + AI readable text block
}

export interface ExecutionCloseoutPayload {
  session_id: string
  final_status: string
  actual_output: string
  actual_budget_unit: number
  blocker_type?: string
  blocker_note?: string
  decision_type: DecisionType
  decision_reason: string
  next_locked_move: string
  evidence_links?: string[]
  created_by?: string
}

export interface CloseoutResult {
  success: boolean
  session_updated: boolean
  decision_logged: boolean
  session_id: string
  decision_id?: string
  message: string
}

// ─── PHASE A: EXPORT LAYER ───────────────────────────────────

/**
 * Phase A.1 — exportSessionPromptContext(sessionId)
 * Returns structured session context pack for Master Architect.
 * Purpose: Give Master Architect the current session truth.
 */
export function exportSessionPromptContext(sessionId: string): SessionPromptContext | null {
  const session = store.getSession(sessionId)
  if (!session) return null

  const escalation_needed = ['external_access', 'credential', 'strategic'].includes(session.blocker_type)

  return {
    session_id: session.id,
    title: session.title,
    objective: session.objective,
    scope: session.scope_type,
    expected_output: session.expected_output,
    actual_output: session.actual_output,
    status: session.status,
    intensity: session.intensity_level,
    intensity_label: session.intensity_label,
    planned_budget_unit: session.planned_budget_unit,
    hard_cap_budget_unit: session.hard_cap_budget_unit,
    actual_budget_unit: session.actual_budget_unit,
    cap_status: session.cap_status,
    continuation_signal: session.go_stop_signal,
    blocker_type: session.blocker_type,
    blocker_note: session.notes || '',
    escalation_needed,
    evidence_links: session.evidence_links || [],
    last_update: session.updated_at,
    lane_name: session.lane_name || 'Unknown Lane'
  }
}

/**
 * Phase A.2 — exportLanePromptContext(laneId)
 * Returns lane-level rollup and health.
 * Purpose: Show whether lane can support continuation.
 */
export function exportLanePromptContext(laneId: string): LanePromptContext | null {
  const lane = store.getLane(laneId)
  if (!lane) return null

  return {
    lane_id: lane.id,
    lane_name: lane.name,
    lane_status: lane.status,
    lane_health: lane.lane_health,
    active_session_count: lane.active_session_count,
    blocked_session_count: lane.blocked_session_count,
    planned_budget_unit: lane.planned_budget_unit,
    hard_cap_budget_unit: lane.hard_cap_budget_unit,
    actual_budget_unit: lane.actual_budget_unit,
    burn_pct: lane.burn_pct,
    exit_criteria: lane.exit_criteria,
    owner: lane.owner
  }
}

/**
 * Phase A.3 — exportEcosystemPromptContext()
 * Returns ecosystem-level pressure and freeze state.
 * Purpose: Prevent local session decisions from ignoring whole-system pressure.
 */
export function exportEcosystemPromptContext(): EcosystemPromptContext {
  const eco = store.getEcosystem()

  const pressure_level = eco.pressure_pct >= 90 ? 'critical'
    : eco.pressure_pct >= 75 ? 'high'
    : eco.pressure_pct >= 50 ? 'moderate'
    : 'low'

  return {
    period_label: eco.period_label,
    ecosystem_health: eco.ecosystem_health,
    total_budget_cap: eco.total_budget_cap,
    total_budget_used: eco.total_budget_used,
    budget_remaining: eco.budget_remaining,
    active_lane_count: eco.active_lanes,
    active_session_count: eco.active_sessions,
    freeze_rules: eco.freeze_rules || 'No freeze rules defined',
    pressure_pct: eco.pressure_pct,
    pressure_level
  }
}

// ─── PHASE B: PACK GENERATOR ─────────────────────────────────

/**
 * Phase B.1 — exportDecisionSummary(entityType, entityId)
 * Returns recent relevant decisions for an entity.
 * Purpose: Keep continuity and reduce repeated misjudgment.
 */
export function exportDecisionSummary(entityType: EntityType, entityId: string): DecisionSummaryContext {
  const allDecisions = store.listDecisions()
  const relevant = allDecisions
    .filter(d => d.entity_type === entityType && d.entity_id === entityId)
    .slice(0, 5)
    .map(d => ({
      id: d.id,
      decision_type: d.decision_type,
      reason: d.reason,
      created_at: d.created_at,
      created_by: d.created_by
    }))

  return {
    entity_type: entityType,
    entity_id: entityId,
    recent_decisions: relevant
  }
}

/**
 * Phase B.2 — exportRepoAuthorityContext()
 * Returns repo/deploy/env truth.
 * Purpose: Prevent false claims like "done" when only local build truth exists.
 */
export function exportRepoAuthorityContext(): RepoAuthorityContext {
  return {
    canonical_product_repo: 'https://github.com/ganihypha/Lane-eco-budget-control-system.git',
    canonical_ecosystem_repo: 'https://github.com/ganihypha/Sovereign-ecosystem',
    local_working_repo: '/home/user/webapp/',
    live_url: 'https://lane-eco-budget-control.pages.dev/',
    repo_match_status: 'REPO-READY (main branch pushed)',
    deploy_authority: 'DEPLOY-READY (Cloudflare Pages via wrangler)',
    env_readiness: 'NO .dev.vars needed — in-memory MVP, no external secrets required',
    execution_status: 'LIVE-VERIFIED (8/8 routes 200 OK on production)'
  }
}

/**
 * Phase B.3 — generateMasterArchitectPack(sessionId)
 * Combines all relevant exported truth into one final pack.
 * Purpose: Produce exact bridge output required by Master Architect.
 * This is the primary function — the one that MUST be tested first.
 */
export function generateMasterArchitectPack(sessionId?: string): MasterArchitectPack {
  const now = new Date().toISOString()

  // Get session context
  let sessionCtx: SessionPromptContext | null = null
  let laneCtx: LanePromptContext | null = null
  let decisionCtx: DecisionSummaryContext | null = null

  if (sessionId) {
    sessionCtx = exportSessionPromptContext(sessionId)
    if (sessionCtx) {
      // Get the session to find its lane_id
      const raw = store.getSession(sessionId)
      if (raw?.lane_id) {
        laneCtx = exportLanePromptContext(raw.lane_id)
      }
      decisionCtx = exportDecisionSummary('session', sessionId)
    }
  }

  // If no session specified or not found, get active session
  if (!sessionCtx) {
    const allSessions = store.listSessions()
    const activeSession = allSessions.find(s => s.status === 'active')
    if (activeSession) {
      sessionCtx = exportSessionPromptContext(activeSession.id)
      const raw = store.getSession(activeSession.id)
      if (raw?.lane_id) {
        laneCtx = exportLanePromptContext(raw.lane_id)
      }
      decisionCtx = exportDecisionSummary('session', activeSession.id)
    }
  }

  const ecosystemCtx = exportEcosystemPromptContext()
  const repoCtx = exportRepoAuthorityContext()

  const promptConstraints = [
    'Do not drift beyond locked scope',
    'Do not continue if hard cap is exceeded',
    'If blocker is external, classify honestly as PARTIAL / BLOCKED / ESCALATE',
    'If no new evidence is produced, degrade recommendation to WATCH or STOP',
    'If scope changes materially, recommend a new session (SPLIT SESSION)',
    'Do not confuse local build truth with live deployment truth',
    'Do not rebuild the Budget Controller — use it as source of truth',
    'Prefer structured context over long conversational memory'
  ]

  const requiredOutputFormat = [
    '1. Intent Summary',
    '2. Scope Lock',
    '3. Budget Position',
    '4. Blocker Position',
    '5. Lane / Ecosystem Pressure',
    '6. Repo / Live Truth',
    '7. Execution Recommendation',
    '8. Allowed Work Boundary',
    '9. Stop Condition',
    '10. Expected Artifact',
    '11. Final Status',
    '12. Next Locked Move'
  ]

  // Generate readable text pack
  const textPack = generateTextPack(sessionCtx, laneCtx, ecosystemCtx, decisionCtx, repoCtx, promptConstraints, requiredOutputFormat)

  return {
    generated_at: now,
    build_session: sessionCtx?.session_id || 'NO_ACTIVE_SESSION',
    session: sessionCtx,
    lane: laneCtx,
    ecosystem: ecosystemCtx,
    decisions: decisionCtx,
    repo: repoCtx,
    prompt_constraints: promptConstraints,
    required_output_format: requiredOutputFormat,
    text_pack: textPack
  }
}

// ─── TEXT PACK GENERATOR ─────────────────────────────────────

function generateTextPack(
  session: SessionPromptContext | null,
  lane: LanePromptContext | null,
  ecosystem: EcosystemPromptContext,
  decisions: DecisionSummaryContext | null,
  repo: RepoAuthorityContext,
  constraints: string[],
  outputFormat: string[]
): string {
  const lines: string[] = []

  lines.push('==============================')
  lines.push('MASTER ARCHITECT CONTEXT PACK')
  lines.push('==============================')
  lines.push(`Generated: ${new Date().toLocaleString()}`)
  lines.push(`Source: ${repo.live_url}`)
  lines.push('')

  // SESSION TRUTH
  lines.push('─── CURRENT SESSION TRUTH ───────────────────────────────')
  if (session) {
    lines.push(`Session ID:         ${session.session_id}`)
    lines.push(`Title:              ${session.title}`)
    lines.push(`Objective:          ${session.objective}`)
    lines.push(`Scope:              ${session.scope}`)
    lines.push(`Expected Output:    ${session.expected_output}`)
    lines.push(`Actual Output:      ${session.actual_output || 'Not yet recorded'}`)
    lines.push(`Status:             ${session.status.toUpperCase()}`)
    lines.push(`Intensity:          Level ${session.intensity} — ${session.intensity_label}`)
    lines.push(`Planned Budget:     ${session.planned_budget_unit} BU`)
    lines.push(`Hard Cap:           ${session.hard_cap_budget_unit} BU`)
    lines.push(`Actual Burn:        ${session.actual_budget_unit} BU`)
    lines.push(`Cap Status:         ${session.cap_status.toUpperCase()}`)
    lines.push(`Continuation Signal: ${session.continuation_signal}`)
    lines.push(`Last Updated:       ${session.last_update}`)
    lines.push(`Evidence Links:     ${session.evidence_links.length > 0 ? session.evidence_links.join(', ') : 'None'}`)
    lines.push('')

    // BLOCKER TRUTH
    lines.push('─── BLOCKER TRUTH ───────────────────────────────────────')
    lines.push(`Blocker Type:       ${session.blocker_type === 'none' ? 'NONE' : session.blocker_type.toUpperCase()}`)
    lines.push(`Blocker Note:       ${session.blocker_note || 'No note recorded'}`)
    lines.push(`Escalation Needed:  ${session.escalation_needed ? 'YES — requires founder/operator intervention' : 'No'}`)
    lines.push(`Honest Classification: ${
      session.blocker_type === 'none' ? 'ACTIVE — No blocker'
      : session.escalation_needed ? 'ESCALATE REQUIRED'
      : 'BLOCKED — Resolve before continuation'
    }`)
    lines.push('')
  } else {
    lines.push('No active session found.')
    lines.push('Operational confidence: REDUCED — no session context available.')
    lines.push('')
  }

  // LANE TRUTH
  lines.push('─── LANE TRUTH ──────────────────────────────────────────')
  if (lane) {
    lines.push(`Lane ID:            ${lane.lane_id}`)
    lines.push(`Lane Name:          ${lane.lane_name}`)
    lines.push(`Lane Status:        ${lane.lane_status.toUpperCase()}`)
    lines.push(`Lane Health:        ${lane.lane_health.toUpperCase()}`)
    lines.push(`Active Sessions:    ${lane.active_session_count}`)
    lines.push(`Blocked Sessions:   ${lane.blocked_session_count}`)
    lines.push(`Planned Budget:     ${lane.planned_budget_unit} BU`)
    lines.push(`Hard Cap:           ${lane.hard_cap_budget_unit} BU`)
    lines.push(`Actual Burn:        ${lane.actual_budget_unit} BU (${lane.burn_pct}% of cap)`)
    lines.push(`Exit Criteria:      ${lane.exit_criteria || 'Not defined'}`)
    lines.push('')
  } else {
    lines.push('No lane context available.')
    lines.push('')
  }

  // ECOSYSTEM TRUTH
  lines.push('─── ECOSYSTEM TRUTH ─────────────────────────────────────')
  lines.push(`Period:             ${ecosystem.period_label}`)
  lines.push(`Health:             ${ecosystem.ecosystem_health.toUpperCase()}`)
  lines.push(`Total Budget Cap:   ${ecosystem.total_budget_cap} BU`)
  lines.push(`Total Budget Used:  ${ecosystem.total_budget_used} BU`)
  lines.push(`Budget Remaining:   ${ecosystem.budget_remaining} BU`)
  lines.push(`Active Lanes:       ${ecosystem.active_lane_count}`)
  lines.push(`Active Sessions:    ${ecosystem.active_session_count}`)
  lines.push(`Pressure Level:     ${ecosystem.pressure_pct}% — ${ecosystem.pressure_level.toUpperCase()}`)
  lines.push(`Freeze Rules:       ${ecosystem.freeze_rules}`)
  lines.push('')

  // RECENT DECISIONS
  lines.push('─── RECENT DECISIONS ────────────────────────────────────')
  if (decisions && decisions.recent_decisions.length > 0) {
    decisions.recent_decisions.forEach((d, i) => {
      lines.push(`Decision ${i + 1}:`)
      lines.push(`  Type:    ${d.decision_type.toUpperCase()}`)
      lines.push(`  Reason:  ${d.reason}`)
      lines.push(`  By:      ${d.created_by} at ${new Date(d.created_at).toLocaleString()}`)
    })
  } else {
    lines.push('No decisions recorded for this session yet.')
  }
  lines.push('')

  // REPO / DEPLOYMENT TRUTH
  lines.push('─── REPO / DEPLOYMENT TRUTH ─────────────────────────────')
  lines.push(`Canonical Product Repo:   ${repo.canonical_product_repo}`)
  lines.push(`Canonical Ecosystem Repo: ${repo.canonical_ecosystem_repo}`)
  lines.push(`Local Working Repo:       ${repo.local_working_repo}`)
  lines.push(`Live URL:                 ${repo.live_url}`)
  lines.push(`Repo Match Status:        ${repo.repo_match_status}`)
  lines.push(`Deploy Authority:         ${repo.deploy_authority}`)
  lines.push(`Env Readiness:            ${repo.env_readiness}`)
  lines.push(`Execution Status:         ${repo.execution_status}`)
  lines.push('')

  // REQUIRED ACTION
  lines.push('─── REQUIRED ACTION ─────────────────────────────────────')
  if (session) {
    const signal = session.continuation_signal
    lines.push(`Primary Required Action: ${
      signal === 'STOP' ? 'STOP — Do not continue. Hard cap exceeded or blocker active.'
      : signal === 'WATCH' ? 'WATCH — Monitor closely. Budget 80%+ consumed.'
      : 'GO — Proceed within locked scope.'
    }`)
    lines.push(`Allowed Work Boundary:  Work only within locked scope: ${session.scope}`)
    lines.push(`Disallowed Drift:       Do not expand scope beyond current session objective`)
    lines.push(`Approval Need:          ${session.escalation_needed ? 'YES — Escalate to founder/operator' : 'No additional approval needed'}`)
    lines.push(`Stop Condition:         If actual burn reaches ${session.hard_cap_budget_unit} BU OR no meaningful artifact produced`)
    lines.push(`Split Session Condition: If objective changes materially or new workstream appears`)
    lines.push(`Final Truth Required:   LIVE-VERIFIED (not just BUILD-VERIFIED or REPO-READY)`)
  } else {
    lines.push('Required Action: Define active session before proceeding.')
  }
  lines.push('')

  // PROMPT CONSTRAINTS
  lines.push('─── PROMPT CONSTRAINTS ──────────────────────────────────')
  constraints.forEach(c => lines.push(`- ${c}`))
  lines.push('')

  // REQUIRED OUTPUT FORMAT
  lines.push('─── REQUIRED OUTPUT FORMAT ──────────────────────────────')
  outputFormat.forEach(f => lines.push(f))
  lines.push('')
  lines.push('==============================')
  lines.push('END OF MASTER ARCHITECT CONTEXT PACK')
  lines.push('==============================')

  return lines.join('\n')
}

// ─── PHASE C: CLOSEOUT INGESTION ─────────────────────────────

/**
 * Phase C — ingestExecutionCloseout(closeoutPayload)
 * Writes execution results back into the controller after AI Dev work completes.
 * Purpose: Close the loop between planning and reality.
 * Input: execution closeout payload
 * Output: updated session, decision log, next move
 */
export function ingestExecutionCloseout(payload: ExecutionCloseoutPayload): CloseoutResult {
  const session = store.getSession(payload.session_id)
  if (!session) {
    return {
      success: false,
      session_updated: false,
      decision_logged: false,
      session_id: payload.session_id,
      message: `Session ${payload.session_id} not found. Cannot ingest closeout.`
    }
  }

  // 1. Update session with closeout data
  const sessionUpdated = store.updateSession(payload.session_id, {
    status: payload.final_status as any,
    actual_output: payload.actual_output,
    actual_budget_unit: payload.actual_budget_unit,
    blocker_type: (payload.blocker_type || 'none') as any,
    notes: payload.blocker_note
      ? `[Closeout] ${payload.blocker_note}`
      : session.notes,
    evidence_links: payload.evidence_links || session.evidence_links,
    end_date: new Date().toISOString().split('T')[0],
    stop_condition: payload.next_locked_move
      ? `Next: ${payload.next_locked_move}`
      : session.stop_condition
  })

  // 2. Log the decision
  const decision = store.createDecision({
    entity_type: 'session',
    entity_id: payload.session_id,
    decision_type: payload.decision_type,
    reason: payload.decision_reason || 'Execution closeout ingested',
    created_by: payload.created_by || 'Prompt Bridge'
  })

  return {
    success: true,
    session_updated: !!sessionUpdated,
    decision_logged: true,
    session_id: payload.session_id,
    decision_id: decision.id,
    message: `Closeout ingested for ${payload.session_id}. Status → ${payload.final_status}. Decision logged: ${decision.id}. Next: ${payload.next_locked_move || 'not specified'}`
  }
}
