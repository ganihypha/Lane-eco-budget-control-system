// ============================================================
// PROMPT BRIDGE — Lane-Eco Budget Control System
// Phase A: Export Layer
// Phase B: Pack Generator (upgraded: Sovereign-grounded)
// Phase C: Closeout Ingestion
// Phase D: Sovereign Source Integration (HUB-18)
// Phase E: Truth-Maturity Upgrade (HUB-19)
//
// Spec: Prompt Bridge Doc v1.0 + Sovereign Source Intake Spec
// Purpose: Convert structured operational truth from the Budget
//          Controller into a clean Master Architect Context Pack
//          for AI Dev / executor sessions.
//          Now grounded with P1 canonical Sovereign source truth.
//
// Truth Precedence applied in generateMasterArchitectPack:
//   P1 current-handoff → P2 active-priority →
//   P3 live controller → P4 repo/deploy → P5 notes
//
// DO NOT: Replace the app, rebuild the dashboard, or act as
//         a fake billing engine.
// ============================================================

import { store } from './store'
import {
  sovereignStore,
  mergeSovereignTruthWithControllerState,
  getSovereignIntakeSummary,
  type MergedTruthContext,
  type SovereignIntakeSummary
} from './sovereign'
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
  // Sovereign Source grounding (HUB-18)
  sovereign_grounded: boolean
  sovereign_summary: SovereignIntakeSummary
  merged_truth: MergedTruthContext
  truth_maturity_level: string  // HUB-19: NONE/LOW/MEDIUM/HIGH
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
 * Phase B.3 (Upgraded HUB-18) — generateMasterArchitectPack(sessionId)
 * Combines all relevant exported truth into one final pack.
 * Now grounded with Sovereign Source Intake (P1 precedence).
 *
 * Precedence applied:
 *   P1 sovereign current-handoff  (if ingested)
 *   P2 sovereign active-priority  (future)
 *   P3 live controller state       (always present)
 *   P4 repo/deploy runtime         (always present)
 *   P5 conversational notes        (low-weight)
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

  // ── SOVEREIGN SOURCE MERGE (P1/P2 grounding) ───────────────
  const activePayload = sovereignStore.getActive()
  const mergedTruth = mergeSovereignTruthWithControllerState(
    activePayload,
    sessionCtx?.session_id
  )
  const sovereignSummary = getSovereignIntakeSummary()
  const sovereign_grounded = sovereignSummary.has_active_source

  // Augment repoCtx with sovereign supplement if available
  const effectiveRepo: RepoAuthorityContext = {
    ...repoCtx,
    canonical_product_repo: mergedTruth.repo_supplement.product_repo || repoCtx.canonical_product_repo,
    canonical_ecosystem_repo: mergedTruth.repo_supplement.ecosystem_repo || repoCtx.canonical_ecosystem_repo,
    live_url: mergedTruth.repo_supplement.live_url || repoCtx.live_url,
    execution_status: mergedTruth.deploy_state_override
      ? `${mergedTruth.deploy_state_override.toUpperCase().replace(/_/g, '-')} (from ${mergedTruth.primary_source})`
      : repoCtx.execution_status
  }

  const promptConstraints = [
    'Do not drift beyond locked scope',
    'Do not continue if hard cap is exceeded',
    'If blocker is external, classify honestly as PARTIAL / BLOCKED / ESCALATE',
    'If no new evidence is produced, degrade recommendation to WATCH or STOP',
    'If scope changes materially, recommend a new session (SPLIT SESSION)',
    'Do not confuse local build truth with live deployment truth',
    'Do not rebuild the Budget Controller — use it as source of truth',
    'Prefer structured context over long conversational memory',
    // Sovereign-specific constraints
    'Respect governance freeze: if canon_status=frozen, do not alter governance fields',
    'Truth precedence: P1 current-handoff > P2 active-priority > P3 controller > P4 repo > P5 notes',
    ...(mergedTruth.governance_frozen ? ['GOVERNANCE CANON FROZEN — no modifications to canonical session archive'] : []),
    ...(mergedTruth.next_locked_move ? [`Next locked move from sovereign source: ${mergedTruth.next_locked_move}`] : [])
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

  // Generate readable text pack (now sovereign-grounded)
  const textPack = generateTextPack(
    sessionCtx, laneCtx, ecosystemCtx, decisionCtx, effectiveRepo,
    promptConstraints, requiredOutputFormat, mergedTruth, sovereignSummary
  )

  return {
    generated_at: now,
    build_session: sessionCtx?.session_id || 'NO_ACTIVE_SESSION',
    session: sessionCtx,
    lane: laneCtx,
    ecosystem: ecosystemCtx,
    decisions: decisionCtx,
    repo: effectiveRepo,
    prompt_constraints: promptConstraints,
    required_output_format: requiredOutputFormat,
    text_pack: textPack,
    sovereign_grounded,
    sovereign_summary: sovereignSummary,
    merged_truth: mergedTruth,
    truth_maturity_level: mergedTruth.truth_maturity || 'LOW'
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
  outputFormat: string[],
  mergedTruth?: MergedTruthContext,
  sovereignSummary?: SovereignIntakeSummary
): string {
  const lines: string[] = []

  lines.push('==============================')
  lines.push('MASTER ARCHITECT CONTEXT PACK')
  lines.push('==============================')
  lines.push(`Generated: ${new Date().toLocaleString()}`)
  lines.push(`Source: ${repo.live_url}`)

  // ── TRUTH MATURITY HEADER (HUB-19) ─────────────────────────
  const maturity = mergedTruth?.truth_maturity || (sovereignSummary?.has_active_source ? 'MEDIUM' : 'LOW')
  lines.push(`Truth Maturity:   ${maturity}`)

  if (sovereignSummary?.has_active_source) {
    // HUB-19: show safe_source_id, not any URL or tokenized endpoint
    const safeId = sovereignSummary.safe_source_id || sovereignSummary.active_doc_id
    lines.push(`Sovereign Source: ${safeId} (${sovereignSummary.active_precedence} — ${sovereignSummary.active_doc_type})`)
    lines.push(`Source Confidence: ${sovereignSummary.confidence?.toUpperCase()}`)
    if (sovereignSummary.confidence_breakdown) {
      const bd = sovereignSummary.confidence_breakdown
      lines.push(`Confidence Score: ${bd.dimensions_met}/${bd.total_dimensions} dimensions met`)
    }
  } else {
    lines.push('Sovereign Source: NOT INGESTED — controller_fallback (P3) only')
    lines.push('Source Confidence: LOW — no P1 current-handoff loaded')
    lines.push('Action Required:  Ingest current-handoff at /sovereign to raise truth maturity')
  }
  lines.push('')

  // Sovereign merge warnings + conflicts (compact & actionable)
  if (mergedTruth) {
    const warnings = mergedTruth.merge_warnings.filter(w => !w.includes('No P1/P2') || !sovereignSummary?.has_active_source)
    if (warnings.length > 0 || mergedTruth.conflicts.length > 0 || mergedTruth.unresolved_fields.length > 0) {
      lines.push('─── SOVEREIGN INTAKE DIAGNOSTICS ────────────────────────')
      if (mergedTruth.conflicts.length > 0) {
        mergedTruth.conflicts.forEach(c => lines.push(`⚡ CONFLICT: ${c}`))
        mergedTruth.conflict_resolutions.forEach(r => lines.push(`✓  RESOLVED: ${r}`))
      }
      if (mergedTruth.unresolved_fields.length > 0) {
        lines.push(`⚠  Unresolved fields (${mergedTruth.unresolved_fields.length}): ${mergedTruth.unresolved_fields.slice(0, 4).join(', ')}`)
      }
      if (mergedTruth.controller_fallback_fields.length > 0) {
        lines.push(`ℹ  Controller fallback used for: ${mergedTruth.controller_fallback_fields.slice(0, 3).join(', ')}`)
      }
      if (warnings.length > 0) {
        warnings.slice(0, 2).forEach(w => lines.push(`⚠  ${w}`))
      }
      lines.push('')
    }
  }
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

  // GOVERNANCE TRUTH (HUB-19: immutable frozen + honest unresolved)
  {
    lines.push('─── GOVERNANCE / CANON TRUTH ────────────────────────────')
    const canonStatusDisplay = mergedTruth?.canon_status || 'unresolved — not found in canonical source'
    const isKnownUnresolved = canonStatusDisplay.startsWith('unresolved') || canonStatusDisplay === 'unknown'

    if (mergedTruth?.governance_frozen) {
      // HUB-19: Frozen governance — immutable, explicitly labeled
      lines.push(`Canon Status:           ${canonStatusDisplay.toUpperCase()} 🔒 FROZEN (IMMUTABLE)`)
      lines.push(`Immutability:           Cannot be overridden by P2/P3/P4/P5 sources`)
      if (mergedTruth.freeze_rules_override) {
        lines.push(`Freeze Rules:           ${mergedTruth.freeze_rules_override}`)
      }
      if (mergedTruth.priority_order.length > 0) {
        lines.push(`Priority Order:         ${mergedTruth.priority_order.join(' > ')} [canonical_truth P1]`)
      }
      lines.push('⚠  GOVERNANCE CANON FROZEN — modifications require explicit Founder approval')
      lines.push(`Source Authority:       ${mergedTruth.primary_source}`)
    } else if (mergedTruth && !isKnownUnresolved) {
      lines.push(`Canon Status:           ${canonStatusDisplay.toUpperCase()} [canonical_truth P1]`)
      if (mergedTruth.priority_order.length > 0) {
        lines.push(`Priority Order:         ${mergedTruth.priority_order.join(' > ')}`)
      }
      lines.push(`Source Authority:       ${mergedTruth.primary_source}`)
    } else {
      // HUB-19: honest unresolved rendering
      lines.push(`Canon Status:           unresolved — not found in canonical source`)
      lines.push(`Note:                   controller_fallback applied (P3) — no governance section in P1 doc`)
      lines.push(`Action:                 Ingest a current-handoff doc with a governance/canon section`)
    }
    lines.push('')
  }

  // REPO / DEPLOYMENT TRUTH (HUB-19: with explicit provenance per field)
  lines.push('─── REPO / DEPLOYMENT TRUTH ─────────────────────────────')
  const repoProductSrc = mergedTruth?.field_sources?.['repo_supplement.product_repo'] || 'controller_fallback (P3)'
  const repoLiveUrlSrc = mergedTruth?.field_sources?.['repo_supplement.live_url'] || 'controller_fallback (P3)'
  const repoDeployStateSrc = mergedTruth?.field_sources?.['repo_supplement.deploy_state'] || 'controller_fallback (P3)'
  lines.push(`Canonical Product Repo:   ${repo.canonical_product_repo}  [${repoProductSrc}]`)
  lines.push(`Canonical Ecosystem Repo: ${repo.canonical_ecosystem_repo}  [${repoProductSrc}]`)
  lines.push(`Local Working Repo:       ${repo.local_working_repo}`)
  lines.push(`Live URL:                 ${repo.live_url}  [${repoLiveUrlSrc}]`)
  lines.push(`Repo Match Status:        ${repo.repo_match_status}`)
  lines.push(`Deploy Authority:         ${repo.deploy_authority}`)
  lines.push(`Env Readiness:            ${repo.env_readiness}`)
  lines.push(`Execution Status:         ${repo.execution_status}  [${repoDeployStateSrc}]`)
  if (mergedTruth?.deploy_state_override) {
    lines.push(`Sovereign Deploy State:   ${mergedTruth.deploy_state_override.toUpperCase().replace(/_/g, '-')} [canonical_truth P1]`)
  }
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
    if (mergedTruth?.next_locked_move) {
      lines.push('')
      const nlmSrc = mergedTruth.field_sources?.['next_locked_move'] || 'canonical_truth P1'
      lines.push(`Next Locked Move (P1):  ${mergedTruth.next_locked_move}  [${nlmSrc}]`)
    } else if (mergedTruth) {
      lines.push('')
      lines.push(`Next Locked Move:       unresolved — not found in canonical source (P1)`)
      lines.push(`Note:                   Check current-handoff for "Next Locked Move:" section`)
    }
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

  // SOVEREIGN SOURCE REFERENCE (HUB-19: safe labels, extraction completeness)
  if (sovereignSummary) {
    lines.push('─── SOVEREIGN SOURCE REFERENCE ──────────────────────────')
    const safeId = sovereignSummary.safe_source_id || sovereignSummary.active_doc_id || 'NONE'
    lines.push(`Active Source ID: ${safeId}  (safe_source_id — never a URL or endpoint)`)
    lines.push(`Doc Type:         ${sovereignSummary.active_doc_type || 'N/A'}`)
    lines.push(`Precedence:       ${sovereignSummary.active_precedence || 'N/A'}`)
    lines.push(`Truth Maturity:   ${sovereignSummary.truth_maturity || 'NONE'}`)
    lines.push(`Confidence:       ${sovereignSummary.confidence?.toUpperCase() || 'NONE'}`)
    lines.push('')
    lines.push('Extraction Completeness:')
    if (mergedTruth?.extraction_completeness) {
      const ec = mergedTruth.extraction_completeness
      lines.push(`  Sessions found:    ${ec.sessions_found}`)
      lines.push(`  Modules found:     ${ec.modules_found}`)
      lines.push(`  Governance found:  ${ec.governance_found ? 'YES' : 'NO'}`)
      lines.push(`  Next move found:   ${ec.next_move_found ? 'YES' : 'NO'}`)
      lines.push(`  Repo truth found:  ${ec.repo_truth_found ? 'YES' : 'NO'}`)
    } else {
      lines.push(`  Sessions found:    ${sovereignSummary.sessions_extracted}`)
      lines.push(`  Modules found:     ${sovereignSummary.modules_extracted}`)
      lines.push(`  Governance:        ${sovereignSummary.governance_status}`)
    }
    lines.push('')
    if (sovereignSummary.has_active_source) {
      lines.push(`Deploy State:     ${sovereignSummary.deploy_state?.toUpperCase().replace(/_/g, '-') || 'UNKNOWN'}`)
      if (sovereignSummary.ingested_at) {
        lines.push(`Ingested At:      ${new Date(sovereignSummary.ingested_at).toLocaleString()}`)
      }
    } else {
      lines.push('Status:           NO SOURCE INGESTED — pack is controller_fallback (P3) only')
      lines.push('Action:           POST /sovereign/api/ingest { doc_id, doc_type: "current-handoff", content }')
    }
    lines.push('')
  }

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
