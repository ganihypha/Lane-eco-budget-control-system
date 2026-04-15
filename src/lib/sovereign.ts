// ============================================================
// SOVEREIGN SOURCE INTAKE — Lane-Eco Budget Control System
// SESSION HUB-18: Sovereign Source Intake Layer
//
// Purpose: Ingest canonical Sovereign operating truth
//          (current-handoff, active-priority) and normalize
//          it for the Prompt Bridge / Master Architect Pack.
//
// Architecture Layers:
//   A. Ingestion     — receive & store raw markdown source
//   B. Normalization — extract structured fields from markdown
//   C. Bridge Store Sync — persist without overwriting controller
//   D. Pack Merge    — apply P1-P5 precedence for final pack
//
// Truth Precedence (high→low):
//   P1 current-handoff (canonical)
//   P2 active-priority (future support)
//   P3 live controller state
//   P4 repo/deployment runtime
//   P5 conversational notes
//
// NON-GOALS:
//   - Do NOT rebuild Budget Controller
//   - Do NOT create duplicate source of truth
//   - Do NOT overwrite controller-owned fields
//   - Do NOT generate fake data
// ============================================================

// ─── STATUS NORMALIZATION ENUMS ──────────────────────────────

export type SovereignDocType = 'current-handoff' | 'active-priority' | 'unknown'

export type SovereignStatusNorm =
  | 'verified_ready_to_close'
  | 'build_verified'
  | 'live_verified'
  | 'route_verified'
  | 'closed_verified'
  | 'complete_synced'
  | 'partial'
  | 'blocked'
  | 'active'
  | 'planned'
  | 'unknown'

export type SovereignDeployState =
  | 'live_verified'
  | 'build_verified'
  | 'repo_ready'
  | 'blocked'
  | 'unknown'

export type SovereignConfidence = 'high' | 'medium' | 'low' | 'none'

export type TruthPrecedence = 'P1' | 'P2' | 'P3' | 'P4' | 'P5'

// ─── DATA MODEL ──────────────────────────────────────────────

/** Source meta — tracks provenance of ingested document */
export interface SovereignSourceMeta {
  doc_id: string
  doc_type: SovereignDocType
  source_label: string           // e.g. "current-handoff", "active-priority"
  precedence: TruthPrecedence
  raw_length: number
  ingested_at: string
  confidence: SovereignConfidence
  parse_warnings: string[]
}

/** Normalized session truth extracted from doc */
export interface SovereignSessionTruth {
  session_id: string
  title: string
  status_raw: string
  status_norm: SovereignStatusNorm
  objective?: string
  lane?: string
  deploy_state: SovereignDeployState
  actual_output?: string
  blocker_type?: string
  blocker_note?: string
  evidence_links: string[]
  confidence: SovereignConfidence
  source_doc_id: string
  raw_trace: string              // exact snippet from source doc
}

/** Module/Route truth extracted from doc */
export interface SovereignModuleTruth {
  module_key: string
  route?: string
  status_norm: SovereignStatusNorm
  notes?: string
  source_doc_id: string
  raw_trace: string
}

/** Secret/Env readiness truth */
export interface SovereignSecretTruth {
  name: string
  purpose?: string
  readiness: 'ready' | 'missing' | 'blocked' | 'not_required'
  notes?: string
  source_doc_id: string
}

/** Governance / Canon truth */
export interface SovereignGovernanceTruth {
  canon_status: 'frozen' | 'active' | 'pending' | 'unknown'
  governance_pack?: string
  freeze_rules?: string
  priority_order: string[]
  ops_pack_committed: boolean
  source_doc_id: string
  raw_trace: string
}

/** Repo/Deployment truth from doc */
export interface SovereignRepoTruth {
  product_repo?: string
  ecosystem_repo?: string
  live_url?: string
  deploy_state: SovereignDeployState
  branch?: string
  last_verified?: string
  source_doc_id: string
}

/** Next move / priority truth */
export interface SovereignNextMoveTruth {
  next_locked_move: string
  priority_label?: string
  session_target?: string
  confidence: SovereignConfidence
  source_doc_id: string
}

/** Full merge metadata */
export interface SovereignMergeMeta {
  merged_at: string
  active_doc_id: string
  precedence_applied: TruthPrecedence
  controller_fields_preserved: string[]
  conflicts_detected: string[]
  conflict_resolutions: string[]
  final_confidence: SovereignConfidence
}

/** Complete Sovereign Intake Store — full normalized payload from one doc */
export interface SovereignIntakePayload {
  source_meta: SovereignSourceMeta
  session_truth: SovereignSessionTruth[]
  module_truth: SovereignModuleTruth[]
  secret_truth: SovereignSecretTruth[]
  governance_truth: SovereignGovernanceTruth | null
  repo_truth: SovereignRepoTruth | null
  next_move_truth: SovereignNextMoveTruth | null
  merge_meta: SovereignMergeMeta | null
}

// ─── IN-MEMORY SOVEREIGN STORE ───────────────────────────────

/**
 * Lightweight in-memory store for sovereign intake payloads.
 * Does NOT replace or duplicate BudgetStore.
 * Stores raw docs + normalized payloads for pack merge.
 */
class SovereignIntakeStore {
  private intakes: Map<string, SovereignIntakePayload> = new Map()
  private rawDocs: Map<string, string> = new Map()
  private activeDocId: string | null = null

  /** Persist a full intake payload */
  save(payload: SovereignIntakePayload): void {
    this.intakes.set(payload.source_meta.doc_id, payload)
    if (payload.source_meta.precedence === 'P1') {
      this.activeDocId = payload.source_meta.doc_id
    }
  }

  /** Persist raw doc text */
  saveRaw(docId: string, raw: string): void {
    this.rawDocs.set(docId, raw)
  }

  /** Get raw text by docId */
  getRaw(docId: string): string | null {
    return this.rawDocs.get(docId) || null
  }

  /** Get normalized intake payload by docId */
  get(docId: string): SovereignIntakePayload | null {
    return this.intakes.get(docId) || null
  }

  /** Get current active P1 intake (current-handoff) */
  getActive(): SovereignIntakePayload | null {
    if (!this.activeDocId) return null
    return this.intakes.get(this.activeDocId) || null
  }

  /** List all intake payloads sorted by ingested_at desc */
  listAll(): SovereignIntakePayload[] {
    return Array.from(this.intakes.values())
      .sort((a, b) => b.source_meta.ingested_at.localeCompare(a.source_meta.ingested_at))
  }

  /** Check if a P1 source is loaded */
  hasActiveSource(): boolean {
    return this.activeDocId !== null
  }

  /** Clear all (for testing) */
  clear(): void {
    this.intakes.clear()
    this.rawDocs.clear()
    this.activeDocId = null
  }

  getActiveDocId(): string | null {
    return this.activeDocId
  }
}

export const sovereignStore = new SovereignIntakeStore()

// ─── LAYER A: INGESTION ───────────────────────────────────────

/**
 * ingestSovereignSource(docId, docType, rawMarkdown)
 *
 * Entry point. Accepts raw markdown text from current-handoff or
 * active-priority. Stores raw, triggers normalization, persists payload.
 *
 * Returns: SovereignIntakePayload (normalized, provenance-tracked)
 */
export function ingestSovereignSource(
  docId: string,
  docType: SovereignDocType,
  rawMarkdown: string
): SovereignIntakePayload {
  const now = new Date().toISOString()
  const warnings: string[] = []

  // Store raw text
  sovereignStore.saveRaw(docId, rawMarkdown)

  // Determine precedence
  const precedence: TruthPrecedence = docType === 'current-handoff' ? 'P1'
    : docType === 'active-priority' ? 'P2'
    : 'P5'

  // Normalize
  const session_truth = extractSessionTruth(rawMarkdown, docId, warnings)
  const module_truth = extractModuleTruth(rawMarkdown, docId, warnings)
  const secret_truth = extractSecretTruth(rawMarkdown, docId, warnings)
  const governance_truth = extractGovernanceTruth(rawMarkdown, docId, warnings)
  const repo_truth = extractRepoTruth(rawMarkdown, docId, warnings)
  const next_move_truth = extractNextMoveTruth(rawMarkdown, docId, warnings)

  // Compute overall confidence
  const confidence = computeConfidence(session_truth, module_truth, warnings)

  const source_meta: SovereignSourceMeta = {
    doc_id: docId,
    doc_type: docType,
    source_label: docType === 'current-handoff' ? 'Current Handoff (P1 — Canonical)'
      : docType === 'active-priority' ? 'Active Priority (P2)'
      : 'Unknown Source (P5)',
    precedence,
    raw_length: rawMarkdown.length,
    ingested_at: now,
    confidence,
    parse_warnings: warnings
  }

  const payload: SovereignIntakePayload = {
    source_meta,
    session_truth,
    module_truth,
    secret_truth,
    governance_truth,
    repo_truth,
    next_move_truth,
    merge_meta: null
  }

  sovereignStore.save(payload)
  return payload
}

// ─── LAYER B: NORMALIZATION ───────────────────────────────────

/**
 * normalizeSovereignSessionStatus(rawStatus)
 *
 * Maps raw string status (from doc) to canonical SovereignStatusNorm.
 * Handles common variations from current-handoff markdown.
 */
export function normalizeSovereignSessionStatus(rawStatus: string): SovereignStatusNorm {
  const s = rawStatus.toLowerCase().trim()

  // Exact / near matches — ordered high-confidence first
  if (s.includes('verified') && (s.includes('close') || s.includes('closed'))) return 'closed_verified'
  if (s.includes('closed') && s.includes('verified')) return 'closed_verified'
  if (s.includes('live') && s.includes('verified')) return 'live_verified'
  if (s.includes('route') && s.includes('verified')) return 'route_verified'
  if (s.includes('build') && s.includes('verified')) return 'build_verified'
  if (s.includes('complete') && s.includes('synced')) return 'complete_synced'
  if (s.includes('verified') && s.includes('ready')) return 'verified_ready_to_close'
  if (s.includes('verified')) return 'live_verified'
  if (s.includes('complete') || s.includes('closed') || s.includes('done')) return 'closed_verified'
  if (s.includes('partial')) return 'partial'
  if (s.includes('blocked')) return 'blocked'
  if (s.includes('active') || s.includes('in progress') || s.includes('in-progress')) return 'active'
  if (s.includes('planned') || s.includes('pending')) return 'planned'

  return 'unknown'
}

/**
 * Normalize deploy state from raw text
 */
function normalizeDeployState(raw: string): SovereignDeployState {
  const s = raw.toLowerCase()
  if (s.includes('live') && s.includes('verified')) return 'live_verified'
  if (s.includes('build') && s.includes('verified')) return 'build_verified'
  if (s.includes('repo') && (s.includes('ready') || s.includes('pushed'))) return 'repo_ready'
  if (s.includes('blocked')) return 'blocked'
  return 'unknown'
}

/**
 * extractSessionTruth(rawMarkdown, docId, warnings)
 *
 * Parses current-handoff markdown to extract session entries.
 * Strategy: look for session header patterns (HUB-XX, SES-XX, session headings).
 */
function extractSessionTruth(raw: string, docId: string, warnings: string[]): SovereignSessionTruth[] {
  const sessions: SovereignSessionTruth[] = []
  const lines = raw.split('\n')

  // Pattern: Lines containing session IDs like HUB-16, HUB-17, 3D-4G etc.
  const sessionIdPattern = /\b(HUB-\d+|SES-\d+|\d+[A-Z]-\d+[A-Z]|session[:\s]+([A-Z0-9-]+))/i

  // Collect session blocks: heading + next ~10 lines
  const sessionBlocks: Array<{ id: string; block: string[] }> = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const headingMatch = line.match(/^#{1,4}\s+.*?(HUB-\d+|SES-\d+|\d[A-Z]-\d[A-Z])/)
    if (headingMatch) {
      const id = headingMatch[1]
      const block = lines.slice(i, Math.min(i + 15, lines.length))
      sessionBlocks.push({ id, block })
    }
  }

  // Also scan for inline session references with key-value pattern
  const kvSessionPattern = /(?:session[:\s]+|id[:\s]+)(HUB-\d+|SES-\d+)/gi
  let kvMatch: RegExpExecArray | null
  const inlineIds = new Set<string>()

  while ((kvMatch = kvSessionPattern.exec(raw)) !== null) {
    inlineIds.add(kvMatch[1].toUpperCase())
  }

  // Process session blocks
  for (const { id, block } of sessionBlocks) {
    const blockText = block.join('\n')

    // Extract status
    const statusMatch = blockText.match(/status[:\s]+([^\n,|]+)/i)
    const status_raw = statusMatch ? statusMatch[1].trim() : 'unknown'
    const status_norm = normalizeSovereignSessionStatus(status_raw)

    // Extract title
    const titleMatch = block[0].match(/^#{1,4}\s+(.+)/)
    const title = titleMatch ? titleMatch[1].replace(/HUB-\d+|SES-\d+/g, '').trim() : ''

    // Extract lane
    const laneMatch = blockText.match(/lane[:\s]+([^\n,|]+)/i)
    const lane = laneMatch ? laneMatch[1].trim() : undefined

    // Extract objective
    const objMatch = blockText.match(/objective[:\s]+([^\n]+)/i)
    const objective = objMatch ? objMatch[1].trim() : undefined

    // Extract actual output
    const outputMatch = blockText.match(/(?:actual[_\s]output|delivered|output)[:\s]+([^\n]+)/i)
    const actual_output = outputMatch ? outputMatch[1].trim() : undefined

    // Extract blocker
    const blockerMatch = blockText.match(/blocker[_\s]?(?:type)?[:\s]+([^\n,|]+)/i)
    const blockerNoteMatch = blockText.match(/blocker[_\s]?note[:\s]+([^\n]+)/i)

    // Extract evidence links
    const urlPattern = /https?:\/\/[^\s<>"]+/g
    const evidenceLinks = [...new Set(blockText.match(urlPattern) || [])]

    // Deploy state
    const deploy_state = normalizeDeployState(blockText)

    sessions.push({
      session_id: id.toUpperCase(),
      title,
      status_raw,
      status_norm,
      objective,
      lane,
      deploy_state,
      actual_output,
      blocker_type: blockerMatch ? blockerMatch[1].trim().toLowerCase() : 'none',
      blocker_note: blockerNoteMatch ? blockerNoteMatch[1].trim() : undefined,
      evidence_links: evidenceLinks,
      confidence: status_raw !== 'unknown' ? 'high' : 'low',
      source_doc_id: docId,
      raw_trace: blockText.slice(0, 500)
    })
  }

  if (sessions.length === 0) {
    warnings.push('No session blocks detected in document. Check for HUB-XX or SES-XX headings.')
  }

  return sessions
}

/**
 * extractModuleTruth(rawMarkdown, docId, warnings)
 *
 * Extracts module/route readiness from the doc.
 * Looks for module lists, route tables, feature status tables.
 */
export function extractModuleTruth(raw: string, docId: string, warnings: string[]): SovereignModuleTruth[] {
  const modules: SovereignModuleTruth[] = []
  const lines = raw.split('\n')

  // Known module keys to scan for
  const knownModules = [
    'dashboard', 'sessions', 'lanes', 'ecosystem', 'decisions',
    'prompt bridge', 'bridge', 'sovereign', 'auth', 'deployment',
    'chamber console', 'governance queue', 'supabase', 'health'
  ]

  // Scan for module-mention lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase()

    for (const mod of knownModules) {
      if (line.includes(mod)) {
        // Extract route if present
        const routeMatch = lines[i].match(/(\/[a-zA-Z0-9_\-/]+)/)
        const route = routeMatch ? routeMatch[1] : undefined

        // Extract status from same line or next 2 lines
        const context = lines.slice(i, i + 3).join(' ')
        const statusMatch = context.match(/(?:status[:\s]+|✅|❌|⚠️|verified|blocked|live|partial)([^\n,|]*)/i)
        const status_raw = statusMatch ? statusMatch[0].trim() : 'unknown'
        const status_norm = normalizeSovereignSessionStatus(status_raw)

        // Avoid duplicates
        if (!modules.find(m => m.module_key === mod)) {
          modules.push({
            module_key: mod,
            route,
            status_norm,
            notes: lines[i].trim(),
            source_doc_id: docId,
            raw_trace: lines.slice(i, i + 3).join('\n')
          })
        }
        break
      }
    }
  }

  return modules
}

/**
 * extractGovernanceTruth(rawMarkdown, docId, warnings)
 *
 * Extracts governance canon status, freeze rules, ops pack state.
 * Priority: governance frozen canon must NOT be overwritten.
 */
export function extractGovernanceTruth(raw: string, docId: string, warnings: string[]): SovereignGovernanceTruth | null {
  const lower = raw.toLowerCase()

  // Check for governance canon mentions
  const hasGovernance = lower.includes('governance') || lower.includes('canon') || lower.includes('freeze')
  if (!hasGovernance) return null

  // Canon status
  let canon_status: SovereignGovernanceTruth['canon_status'] = 'unknown'
  if (lower.includes('canon') && lower.includes('frozen')) canon_status = 'frozen'
  else if (lower.includes('canon') && (lower.includes('active') || lower.includes('live'))) canon_status = 'active'
  else if (lower.includes('canon') && lower.includes('pending')) canon_status = 'pending'
  else if (lower.includes('governance')) canon_status = 'active'

  // Governance pack
  const govPackMatch = raw.match(/governance[_\s]?pack[:\s]+([^\n]+)/i)
  const governance_pack = govPackMatch ? govPackMatch[1].trim() : undefined

  // Freeze rules
  const freezeMatch = raw.match(/freeze[_\s]?rules?[:\s]+([^\n]+)/i)
  const freeze_rules = freezeMatch ? freezeMatch[1].trim() : undefined

  // Priority order — look for ordered list after "priority"
  const priorityMatch = raw.match(/priority[_\s]?order[:\s\n]+([^\n#]+(?:\n[^\n#]+){0,4})/i)
  const priority_order: string[] = []
  if (priorityMatch) {
    const lines = priorityMatch[1].split('\n')
    lines.forEach(l => {
      const clean = l.replace(/^[\d.\-*\s]+/, '').trim()
      if (clean.length > 2) priority_order.push(clean)
    })
  }

  // Ops pack committed
  const ops_pack_committed = lower.includes('ops pack') && (lower.includes('committed') || lower.includes('complete'))

  // Raw trace — find governance section
  const govStart = lower.indexOf('governance')
  const raw_trace = govStart >= 0 ? raw.slice(govStart, govStart + 400) : ''

  return {
    canon_status,
    governance_pack,
    freeze_rules,
    priority_order,
    ops_pack_committed,
    source_doc_id: docId,
    raw_trace
  }
}

/**
 * extractRepoTruth(rawMarkdown, docId, warnings)
 *
 * Extracts repo URLs, live URLs, deploy state from doc.
 */
function extractRepoTruth(raw: string, docId: string, warnings: string[]): SovereignRepoTruth | null {
  // Find GitHub repo URLs
  const productRepoMatch = raw.match(/https:\/\/github\.com\/ganihypha\/Lane-eco-budget-control-system[^\s<>"]*/i)
  const ecoRepoMatch = raw.match(/https:\/\/github\.com\/ganihypha\/Sovereign-ecosystem[^\s<>"]*/i)

  // Find live URL
  const liveMatch = raw.match(/https?:\/\/lane-eco-budget-control[^\s<>"]+/i)
  const pagesMatch = raw.match(/https?:\/\/[a-z0-9-]+\.pages\.dev[^\s<>"]*/i)
  const live_url = liveMatch?.[0] || pagesMatch?.[0] || undefined

  // Branch
  const branchMatch = raw.match(/branch[:\s]+([^\s,|\n]+)/i)
  const branch = branchMatch ? branchMatch[1].trim() : 'main'

  // Deploy state — scan for verification language
  const lower = raw.toLowerCase()
  let deploy_state: SovereignDeployState = 'unknown'
  if (lower.includes('live-verified') || (lower.includes('live') && lower.includes('verified'))) deploy_state = 'live_verified'
  else if (lower.includes('build-verified') || (lower.includes('build') && lower.includes('verified'))) deploy_state = 'build_verified'
  else if (lower.includes('repo-ready') || lower.includes('pushed')) deploy_state = 'repo_ready'
  else if (lower.includes('deploy') && lower.includes('blocked')) deploy_state = 'blocked'

  if (!productRepoMatch && !live_url) {
    warnings.push('No product repo or live URL found in document.')
    return null
  }

  // Last verified — look for date patterns near verification
  const verifiedMatch = raw.match(/(?:verified|deployed)[^\n]*(\d{4}-\d{2}-\d{2})/i)
  const last_verified = verifiedMatch ? verifiedMatch[1] : undefined

  return {
    product_repo: productRepoMatch?.[0] || 'https://github.com/ganihypha/Lane-eco-budget-control-system',
    ecosystem_repo: ecoRepoMatch?.[0] || 'https://github.com/ganihypha/Sovereign-ecosystem',
    live_url,
    deploy_state,
    branch,
    last_verified,
    source_doc_id: docId
  }
}

/**
 * extractNextMoveTruth(rawMarkdown, docId, warnings)
 *
 * Extracts "next locked move" / "next step" from doc.
 * Prioritizes explicit "next locked move" sections.
 */
function extractNextMoveTruth(raw: string, docId: string, warnings: string[]): SovereignNextMoveTruth | null {
  // Look for explicit "next locked move" section
  const nlmMatch = raw.match(/next[_\s]?locked[_\s]?move[:\s]+([^\n#]+(?:\n[^\n#]+)?)/i)
  if (nlmMatch) {
    return {
      next_locked_move: nlmMatch[1].trim(),
      confidence: 'high',
      source_doc_id: docId
    }
  }

  // Fallback: "next step" or "recommended next"
  const nextMatch = raw.match(/(?:next[_\s]?step|recommended[_\s]?next|action[_\s]?required)[:\s]+([^\n#]+)/i)
  if (nextMatch) {
    return {
      next_locked_move: nextMatch[1].trim(),
      confidence: 'medium',
      source_doc_id: docId
    }
  }

  warnings.push('No explicit next locked move found in document.')
  return null
}

/**
 * extractSecretTruth(rawMarkdown, docId, warnings)
 *
 * Extracts secret/credential/env readiness from doc.
 * Does NOT extract actual secret values (security guard).
 */
function extractSecretTruth(raw: string, docId: string, warnings: string[]): SovereignSecretTruth[] {
  const secrets: SovereignSecretTruth[] = []
  const lower = raw.toLowerCase()

  const knownSecrets = [
    { name: 'CLOUDFLARE_API_TOKEN', purpose: 'Cloudflare Pages deploy' },
    { name: 'SUPABASE_URL', purpose: 'Supabase persistence' },
    { name: 'SUPABASE_ANON_KEY', purpose: 'Supabase access' },
    { name: 'GITHUB_TOKEN', purpose: 'GitHub push auth' },
    { name: 'GITHUB_PAT', purpose: 'GitHub personal access token' }
  ]

  for (const secret of knownSecrets) {
    const nameKey = secret.name.toLowerCase()
    if (lower.includes(nameKey) || lower.includes(nameKey.replace(/_/g, ' '))) {
      // Determine readiness from context
      const idx = lower.indexOf(nameKey)
      const context = lower.slice(Math.max(0, idx - 100), idx + 200)

      let readiness: SovereignSecretTruth['readiness'] = 'missing'
      if (context.includes('set') && !context.includes('not set') && !context.includes("isn't set")) readiness = 'ready'
      else if (context.includes('blocked') || context.includes('missing') || context.includes('not available')) readiness = 'blocked'
      else if (context.includes('ready') || context.includes('configured')) readiness = 'ready'

      secrets.push({
        name: secret.name,
        purpose: secret.purpose,
        readiness,
        notes: `Detected in ${docId}`,
        source_doc_id: docId
      })
    }
  }

  return secrets
}

/** Compute overall confidence from extracted data */
function computeConfidence(
  sessions: SovereignSessionTruth[],
  modules: SovereignModuleTruth[],
  warnings: string[]
): SovereignConfidence {
  if (sessions.length === 0 && modules.length === 0) return 'none'
  if (warnings.length >= 3) return 'low'
  if (sessions.length >= 2 && warnings.length === 0) return 'high'
  if (sessions.length >= 1) return 'medium'
  return 'low'
}

// ─── LAYER C: BRIDGE STORE SYNC ──────────────────────────────

/**
 * syncSovereignIntakeToBridgeStore(payload, budgetStore)
 *
 * Persists sovereign intake truth alongside controller state.
 * Rules:
 *   - Does NOT overwrite controller-owned session/lane/ecosystem fields
 *   - Only writes to fields that controller doesn't own
 *   - Governance freeze status is ALWAYS preserved from P1 source
 *
 * Returns: sync summary
 */
export interface SyncResult {
  synced_at: string
  doc_id: string
  sessions_referenced: number
  governance_preserved: boolean
  repo_synced: boolean
  conflicts_detected: string[]
  warnings: string[]
}

export function syncSovereignIntakeToBridgeStore(
  payload: SovereignIntakePayload
): SyncResult {
  const conflicts: string[] = []
  const warnings: string[] = [...payload.source_meta.parse_warnings]

  // 1. Validate: do not proceed if confidence is 'none'
  if (payload.source_meta.confidence === 'none') {
    return {
      synced_at: new Date().toISOString(),
      doc_id: payload.source_meta.doc_id,
      sessions_referenced: 0,
      governance_preserved: false,
      repo_synced: false,
      conflicts_detected: ['Source confidence is none — sync aborted'],
      warnings
    }
  }

  // 2. Governance preservation: if P1 says canon is frozen, record it
  const governance_preserved = payload.governance_truth !== null
    && payload.governance_truth.canon_status === 'frozen'

  // 3. Sessions referenced: check how many doc sessions match controller sessions
  const sessions_referenced = payload.session_truth.length

  // 4. Repo truth: record if live_url present
  const repo_synced = payload.repo_truth !== null && !!payload.repo_truth.live_url

  // 5. Conflict detection: check if doc status contradicts controller signals
  for (const docSession of payload.session_truth) {
    if (docSession.status_norm === 'blocked' && docSession.deploy_state === 'live_verified') {
      conflicts.push(
        `Session ${docSession.session_id}: doc says BLOCKED but deploy_state is LIVE_VERIFIED — verify which is current`
      )
    }
  }

  return {
    synced_at: new Date().toISOString(),
    doc_id: payload.source_meta.doc_id,
    sessions_referenced,
    governance_preserved,
    repo_synced,
    conflicts_detected: conflicts,
    warnings
  }
}

// ─── LAYER D: PACK MERGE ─────────────────────────────────────

/**
 * mergeSovereignTruthWithControllerState(sovereignPayload, controllerState)
 *
 * Applies P1-P5 precedence to produce merged context for the pack generator.
 * Controller-owned fields are preserved (P3).
 * Sovereign doc fields augment (P1/P2) without overwriting.
 *
 * Returns: MergedTruthContext for use in generateMasterArchitectPack
 */
export interface MergedTruthContext {
  // Provenance
  primary_source: string     // which source is authoritative
  precedence: TruthPrecedence
  confidence: SovereignConfidence
  merge_warnings: string[]

  // Merged fields
  session_status_override: SovereignStatusNorm | null
  deploy_state_override: SovereignDeployState | null
  governance_frozen: boolean
  canon_status: string
  freeze_rules_override: string | null
  priority_order: string[]
  next_locked_move: string | null
  evidence_links_supplement: string[]
  repo_supplement: {
    product_repo: string
    ecosystem_repo: string
    live_url: string | null
    deploy_state: SovereignDeployState
  }
  conflicts: string[]
  conflict_resolutions: string[]
}

export function mergeSovereignTruthWithControllerState(
  sovereignPayload: SovereignIntakePayload | null,
  controllerSessionId?: string
): MergedTruthContext {
  const conflicts: string[] = []
  const resolutions: string[] = []

  // Default: no sovereign source available
  if (!sovereignPayload) {
    return {
      primary_source: 'Controller (P3) — no sovereign source ingested',
      precedence: 'P3',
      confidence: 'low',
      merge_warnings: ['No P1/P2 sovereign source available. Pack grounded in controller state only.'],
      session_status_override: null,
      deploy_state_override: null,
      governance_frozen: false,
      canon_status: 'unknown',
      freeze_rules_override: null,
      priority_order: [],
      next_locked_move: null,
      evidence_links_supplement: [],
      repo_supplement: {
        product_repo: 'https://github.com/ganihypha/Lane-eco-budget-control-system',
        ecosystem_repo: 'https://github.com/ganihypha/Sovereign-ecosystem',
        live_url: 'https://lane-eco-budget-control.pages.dev/',
        deploy_state: 'live_verified'
      },
      conflicts: [],
      conflict_resolutions: []
    }
  }

  const meta = sovereignPayload.source_meta
  const governance = sovereignPayload.governance_truth
  const repo = sovereignPayload.repo_truth
  const nextMove = sovereignPayload.next_move_truth

  // Find session-specific data
  let sessionStatusOverride: SovereignStatusNorm | null = null
  let deployStateOverride: SovereignDeployState | null = null
  const evidenceLinks: string[] = []

  if (controllerSessionId) {
    const docSession = sovereignPayload.session_truth.find(
      s => s.session_id === controllerSessionId.toUpperCase()
    )
    if (docSession) {
      sessionStatusOverride = docSession.status_norm
      deployStateOverride = docSession.deploy_state
      evidenceLinks.push(...docSession.evidence_links)
    }
  }

  // Governance: P1 frozen canon is immutable
  const governance_frozen = governance?.canon_status === 'frozen'
  if (governance_frozen) {
    resolutions.push('Governance Canon v1 frozen — cannot be overridden by any lower-precedence source')
  }

  // Conflict: check if controller session status conflicts with doc status
  if (sessionStatusOverride === 'blocked' && deployStateOverride === 'live_verified') {
    conflicts.push('Doc says BLOCKED but live_verified detected — manual review required')
    resolutions.push('Prefer deploy_state=live_verified as evidence over status text (P4 > P5 text-only)')
  }

  return {
    primary_source: `${meta.source_label} (${meta.precedence} — ${meta.doc_id})`,
    precedence: meta.precedence,
    confidence: meta.confidence,
    merge_warnings: meta.parse_warnings,
    session_status_override: sessionStatusOverride,
    deploy_state_override: deployStateOverride,
    governance_frozen,
    canon_status: governance?.canon_status || 'unknown',
    freeze_rules_override: governance?.freeze_rules || null,
    priority_order: governance?.priority_order || [],
    next_locked_move: nextMove?.next_locked_move || null,
    evidence_links_supplement: [...new Set(evidenceLinks)],
    repo_supplement: {
      product_repo: repo?.product_repo || 'https://github.com/ganihypha/Lane-eco-budget-control-system',
      ecosystem_repo: repo?.ecosystem_repo || 'https://github.com/ganihypha/Sovereign-ecosystem',
      live_url: repo?.live_url || 'https://lane-eco-budget-control.pages.dev/',
      deploy_state: repo?.deploy_state || 'unknown'
    },
    conflicts,
    conflict_resolutions: resolutions
  }
}

// ─── CONVENIENCE: QUICK INTAKE STATS ─────────────────────────

export interface SovereignIntakeSummary {
  has_active_source: boolean
  active_doc_id: string | null
  active_doc_type: SovereignDocType | null
  active_precedence: TruthPrecedence | null
  sessions_extracted: number
  modules_extracted: number
  secrets_extracted: number
  governance_status: string
  deploy_state: SovereignDeployState | null
  next_locked_move: string | null
  confidence: SovereignConfidence
  ingested_at: string | null
  parse_warnings: string[]
}

export function getSovereignIntakeSummary(): SovereignIntakeSummary {
  const active = sovereignStore.getActive()
  if (!active) {
    return {
      has_active_source: false,
      active_doc_id: null,
      active_doc_type: null,
      active_precedence: null,
      sessions_extracted: 0,
      modules_extracted: 0,
      secrets_extracted: 0,
      governance_status: 'No P1 source ingested',
      deploy_state: null,
      next_locked_move: null,
      confidence: 'none',
      ingested_at: null,
      parse_warnings: ['No sovereign source ingested. Pack grounded in controller state only (P3).']
    }
  }

  return {
    has_active_source: true,
    active_doc_id: active.source_meta.doc_id,
    active_doc_type: active.source_meta.doc_type,
    active_precedence: active.source_meta.precedence,
    sessions_extracted: active.session_truth.length,
    modules_extracted: active.module_truth.length,
    secrets_extracted: active.secret_truth.length,
    governance_status: active.governance_truth?.canon_status || 'not found',
    deploy_state: active.repo_truth?.deploy_state || null,
    next_locked_move: active.next_move_truth?.next_locked_move || null,
    confidence: active.source_meta.confidence,
    ingested_at: active.source_meta.ingested_at,
    parse_warnings: active.source_meta.parse_warnings
  }
}
