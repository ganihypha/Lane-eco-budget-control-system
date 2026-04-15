// ============================================================
// SOVEREIGN SOURCE INTAKE — Lane-Eco Budget Control System
// HUB-20: Persistent Storage + Boot Restore Upgrade
//
// Purpose: Ingest canonical Sovereign operating truth
//          (current-handoff, active-priority) and normalize
//          it for the Prompt Bridge / Master Architect Pack.
//
// Architecture Layers:
//   A. Ingestion     — receive & store raw markdown source
//   B. Normalization — section-aware parser (truth-mature)
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
// HUB-19 Upgrade Areas:
//   A. Section-aware parser — all SESSION block patterns
//   B. Evidence-based confidence scoring with breakdown
//   C. Merge precedence that actually surfaces P1 truth
//   D. URL sanitization (no sensitive/tokenized endpoints)
//   E. Fallback/default rendering honesty
//   F. Truth-maturity metadata for UI
//
// NON-GOALS:
//   - Do NOT rebuild Budget Controller
//   - Do NOT create duplicate source of truth
//   - Do NOT overwrite controller-owned fields
//   - Do NOT generate fake data
//   - Do NOT use LLM as primary parser
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
  | 'e2e_verified'
  | 'partial'
  | 'blocked'
  | 'active'
  | 'planned'
  | 'unknown'

export type SovereignDeployState =
  | 'live_verified'
  | 'e2e_verified'
  | 'build_verified'
  | 'repo_ready'
  | 'blocked'
  | 'unknown'

export type SovereignConfidence = 'high' | 'medium' | 'low' | 'none'

export type TruthPrecedence = 'P1' | 'P2' | 'P3' | 'P4' | 'P5'

export type TruthMaturityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'

// ─── DATA MODEL ──────────────────────────────────────────────

/** Confidence breakdown — evidence-based (HUB-19) */
export interface ConfidenceBreakdown {
  valid_source_type: boolean
  session_blocks_found: boolean
  governance_found: boolean
  repo_deploy_found: boolean
  next_move_found: boolean
  module_truth_found: boolean
  conflicts_resolved_cleanly: boolean
  dimensions_met: number
  total_dimensions: number
  score_label: SovereignConfidence
  truth_maturity: TruthMaturityLevel
}

/** Source meta — tracks provenance of ingested document */
export interface SovereignSourceMeta {
  doc_id: string
  doc_type: SovereignDocType
  source_label: string           // e.g. "current-handoff (P1 — Canonical)"
  precedence: TruthPrecedence
  raw_length: number
  ingested_at: string
  confidence: SovereignConfidence
  confidence_breakdown: ConfidenceBreakdown
  parse_warnings: string[]
  // URL sanitization — safe source label only, no tokenized endpoints
  safe_source_id: string        // doc_id only, never a URL
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
  // HUB-19: explicit provenance
  field_provenance: Record<string, string>  // field → where it came from
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
  frozen_docs_count?: number
  commit_refs: string[]
  priority_order: string[]
  ops_pack_committed: boolean
  source_doc_id: string
  raw_trace: string
  is_immutable: boolean   // HUB-19: explicitly flag frozen as immutable
}

/** Repo/Deployment truth from doc */
export interface SovereignRepoTruth {
  // HUB-19: separated into safe distinct concepts
  source_doc_id: string         // only doc_id, never URL here
  source_doc_type: SovereignDocType
  canonical_product_repo?: string
  canonical_ecosystem_repo?: string
  canonical_live_url?: string
  evidence_urls: string[]       // verified artifact/evidence links
  deploy_state: SovereignDeployState
  branch?: string
  last_verified?: string
  build_session?: string
  // restricted_endpoints never rendered in pack (HUB-19 security)
  _restricted_endpoints_redacted: boolean
}

/** Next move / priority truth */
export interface SovereignNextMoveTruth {
  next_locked_move: string
  suggested_scope?: string
  pending_verification?: string
  priority_label?: string
  session_target?: string
  confidence: SovereignConfidence
  source_doc_id: string
  raw_trace: string
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

// ─── SOVEREIGN STORE (HUB-20: D1-backed with in-memory fallback) ────────────

import { SovereignDBAdapter, type BootRestoreResult, type StorageMode } from './sovereign-db'

/**
 * HUB-20: Unified Sovereign Intake Store
 *
 * Combines:
 *   - SovereignDBAdapter (D1 persistent storage)
 *   - In-memory cache (fast access, populated on boot restore)
 *
 * Storage modes:
 *   persistent  — D1 bound, data survives restart
 *   in-memory   — No D1 binding, ephemeral (warns honestly)
 *   degraded    — D1 bound but error occurred, fallback to in-memory
 *
 * Boot restore:
 *   On app start, initSovereignDB() restores most recent valid P1/P2
 *   source from D1 into in-memory cache.
 */
class SovereignIntakeStore {
  private intakes: Map<string, SovereignIntakePayload> = new Map()
  private rawDocs: Map<string, string> = new Map()
  private activeDocId: string | null = null

  // HUB-20: D1 adapter + boot status
  private dbAdapter: SovereignDBAdapter | null = null
  private _dbInitialized = false
  private _bootStatus: BootRestoreResult = {
    restored: false,
    restored_doc_id: null,
    restored_precedence: null,
    storage_mode: 'in-memory',
    note: 'D1 not yet initialized — awaiting first request.'
  }

  // ── D1 initialization (called once on first request) ──────

  async initDB(db: D1Database): Promise<void> {
    if (this._dbInitialized) return
    this._dbInitialized = true

    this.dbAdapter = new SovereignDBAdapter(db)

    // Attempt boot restore from D1
    const { payload, result } = await this.dbAdapter.restoreActiveSource()
    this._bootStatus = result

    if (payload) {
      // Populate in-memory cache with restored payload
      this.intakes.set(payload.source_meta.doc_id, payload)
      // P1 or P2 — set as active
      if (payload.source_meta.precedence === 'P1' || payload.source_meta.precedence === 'P2') {
        this.activeDocId = payload.source_meta.doc_id
      }
    }
  }

  getStorageMode(): StorageMode {
    return this.dbAdapter?.storageMode ?? 'in-memory'
  }

  getBootStatus(): BootRestoreResult {
    return this._bootStatus
  }

  // ── Save (in-memory + D1 async) ────────────────────────────

  async saveAsync(payload: SovereignIntakePayload, rawContent: string = ''): Promise<void> {
    // Always update in-memory first (fast path)
    this.intakes.set(payload.source_meta.doc_id, payload)
    if (payload.source_meta.precedence === 'P1' || payload.source_meta.precedence === 'P2') {
      this.activeDocId = payload.source_meta.doc_id
    }
    this.rawDocs.set(payload.source_meta.doc_id, rawContent)

    // Persist to D1 if available
    if (this.dbAdapter) {
      await this.dbAdapter.savePayload(payload, rawContent)
      if (payload.source_meta.precedence === 'P1' || payload.source_meta.precedence === 'P2') {
        await this.dbAdapter.setActiveSource(payload.source_meta.doc_id)
      }
    }
  }

  // ── Legacy sync save (kept for backward compat) ───────────

  save(payload: SovereignIntakePayload): void {
    this.intakes.set(payload.source_meta.doc_id, payload)
    if (payload.source_meta.precedence === 'P1' || payload.source_meta.precedence === 'P2') {
      this.activeDocId = payload.source_meta.doc_id
    }
  }

  saveRaw(docId: string, raw: string): void {
    this.rawDocs.set(docId, raw)
  }

  getRaw(docId: string): string | null {
    return this.rawDocs.get(docId) || null
  }

  get(docId: string): SovereignIntakePayload | null {
    return this.intakes.get(docId) || null
  }

  getActive(): SovereignIntakePayload | null {
    if (!this.activeDocId) return null
    return this.intakes.get(this.activeDocId) || null
  }

  listAll(): SovereignIntakePayload[] {
    return Array.from(this.intakes.values())
      .sort((a, b) => b.source_meta.ingested_at.localeCompare(a.source_meta.ingested_at))
  }

  hasActiveSource(): boolean {
    return this.activeDocId !== null
  }

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

// ─── HUB-20: PUBLIC INIT + BOOT STATUS API ───────────────────

/**
 * initSovereignDB(db)
 *
 * Call once from app middleware on first request.
 * Injects D1 binding into sovereign store and triggers boot restore.
 * Idempotent — safe to call on every request.
 */
export async function initSovereignDB(db: D1Database): Promise<void> {
  await sovereignStore.initDB(db)
}

/**
 * getSovereignBootStatus()
 *
 * Returns current boot restore status for health endpoint diagnostics.
 */
export function getSovereignBootStatus(): BootRestoreResult & { storage_mode: StorageMode } {
  const status = sovereignStore.getBootStatus()
  return {
    ...status,
    storage_mode: sovereignStore.getStorageMode()
  }
}

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

  // ── LAYER B: Section-aware normalization ──────────────────
  const session_truth = extractSessionTruth(rawMarkdown, docId, warnings)
  const module_truth = extractModuleTruth(rawMarkdown, docId, warnings)
  const secret_truth = extractSecretTruth(rawMarkdown, docId, warnings)
  const governance_truth = extractGovernanceTruth(rawMarkdown, docId, warnings)
  const repo_truth = extractRepoTruth(rawMarkdown, docId, warnings)
  const next_move_truth = extractNextMoveTruth(rawMarkdown, docId, warnings)

  // ── Evidence-based confidence scoring (HUB-19) ───────────
  const confidence_breakdown = computeConfidenceBreakdown(
    docType, session_truth, module_truth, governance_truth,
    repo_truth, next_move_truth, warnings
  )
  const confidence = confidence_breakdown.score_label

  const source_meta: SovereignSourceMeta = {
    doc_id: docId,
    doc_type: docType,
    // HUB-19: source_label is human-readable, never a URL or endpoint
    source_label: docType === 'current-handoff' ? 'Current Handoff (P1 — Canonical)'
      : docType === 'active-priority' ? 'Active Priority (P2)'
      : 'Unknown Source (P5)',
    precedence,
    raw_length: rawMarkdown.length,
    ingested_at: now,
    confidence,
    confidence_breakdown,
    parse_warnings: warnings,
    // HUB-19: safe_source_id is ONLY doc_id — never an endpoint URL
    safe_source_id: docId
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

  // HUB-20: async save to D1 + in-memory (non-blocking, fire-and-forget)
  // Route handler will await this via ingestSovereignSourceAsync
  sovereignStore.save(payload)
  return payload
}

/**
 * HUB-20: ingestSovereignSourceAsync
 *
 * Same as ingestSovereignSource but persists to D1 as well.
 * Call from route handlers where async context is available.
 */
export async function ingestSovereignSourceAsync(
  docId: string,
  docType: SovereignDocType,
  rawMarkdown: string
): Promise<SovereignIntakePayload> {
  const payload = ingestSovereignSource(docId, docType, rawMarkdown)
  // Persist to D1 (stores in-memory too via saveAsync)
  await sovereignStore.saveAsync(payload, rawMarkdown)
  return payload
}

// ─── LAYER B: NORMALIZATION (HUB-19 SECTION-AWARE) ───────────

/**
 * normalizeSovereignSessionStatus(rawStatus)
 *
 * Maps raw string status to canonical SovereignStatusNorm.
 * Handles all patterns from spec:
 * - STATUS: VERIFIED & CLOSED
 * - STATUS: DEPLOYED AND E2E VERIFIED
 * - STATUS: BUILD-VERIFIED
 * - STATUS: VERIFIED AND READY TO CLOSE
 * Mixed English/Indonesian accepted.
 */
export function normalizeSovereignSessionStatus(rawStatus: string): SovereignStatusNorm {
  const s = rawStatus.toLowerCase().trim()

  // E2E verified patterns
  if (s.includes('e2e') && s.includes('verified')) return 'e2e_verified'
  if (s.includes('deployed') && s.includes('e2e')) return 'e2e_verified'

  // Exact / near matches — ordered high-confidence first
  if ((s.includes('verified') || s.includes('ready')) && s.includes('close')) return 'verified_ready_to_close'
  if (s.includes('verified') && s.includes('and') && s.includes('ready')) return 'verified_ready_to_close'
  if (s.includes('closed') && s.includes('verified')) return 'closed_verified'
  if (s.includes('verified') && (s.includes('close') || s.includes('closed'))) return 'closed_verified'
  if (s.includes('live') && s.includes('verified')) return 'live_verified'
  if (s.includes('route') && s.includes('verified')) return 'route_verified'
  if (s.includes('build') && s.includes('verified')) return 'build_verified'
  if (s.includes('build-verified') || s.includes('build verified')) return 'build_verified'
  if (s.includes('complete') && s.includes('synced')) return 'complete_synced'
  if (s.includes('verified') && s.includes('ready')) return 'verified_ready_to_close'
  // "VERIFIED & CLOSED" — ampersand variant
  if (s.includes('verified') && s.includes('&') && s.includes('close')) return 'closed_verified'
  if (s.includes('deployed') && s.includes('verified')) return 'live_verified'
  if (s.includes('verified')) return 'live_verified'
  if (s.includes('complete') || s.includes('closed') || s.includes('done')) return 'closed_verified'
  if (s.includes('partial')) return 'partial'
  if (s.includes('blocked') || s.includes('diblokir')) return 'blocked'
  if (s.includes('active') || s.includes('in progress') || s.includes('in-progress') || s.includes('berjalan')) return 'active'
  if (s.includes('planned') || s.includes('pending') || s.includes('direncanakan')) return 'planned'

  return 'unknown'
}

/**
 * Normalize deploy state from raw text
 */
function normalizeDeployState(raw: string): SovereignDeployState {
  const s = raw.toLowerCase()
  if (s.includes('e2e') && (s.includes('verified') || s.includes('verified'))) return 'e2e_verified'
  if (s.includes('deployed') && s.includes('e2e')) return 'e2e_verified'
  if (s.includes('live') && s.includes('verified')) return 'live_verified'
  if (s.includes('live-verified') || s.includes('live_verified')) return 'live_verified'
  if (s.includes('build') && s.includes('verified')) return 'build_verified'
  if (s.includes('build-verified') || s.includes('build_verified')) return 'build_verified'
  if (s.includes('repo') && (s.includes('ready') || s.includes('pushed'))) return 'repo_ready'
  if (s.includes('blocked')) return 'blocked'
  return 'unknown'
}

// ─── SESSION BLOCK EXTRACTION (HUB-19: Section-Aware) ────────

/**
 * HUB-19: Section-aware session parser.
 *
 * Detects ALL session block patterns from spec:
 *   - SESSION 4G
 *   - SESSION 4F
 *   - ## SESSION 4A
 *   - ## 🚀 SESSION 4B
 *   - HUB-17, HUB-18 etc
 *   - Status lines: STATUS: VERIFIED & CLOSED
 *   - STATUS: DEPLOYED AND E2E VERIFIED
 *   - STATUS: BUILD-VERIFIED
 *   - STATUS: VERIFIED AND READY TO CLOSE
 *
 * Handles: headings, emojis, mixed EN/ID, tables, bullet lists,
 * code fences, various markdown structures.
 */
function extractSessionTruth(raw: string, docId: string, warnings: string[]): SovereignSessionTruth[] {
  const sessions: SovereignSessionTruth[] = []
  const lines = raw.split('\n')
  const seenIds = new Set<string>()

  // ── Pattern Set 1: Heading-based SESSION blocks ───────────
  // Matches: ## SESSION 4G, ## 🚀 SESSION 4B, ## SESSION 4A — HUB-18, etc.
  // Also: HUB-17, HUB-18, SES-01, etc. as heading subjects
  const sessionHeadingRegex = /^(#{1,4})\s+(?:[^\w]*)?(?:SESSION\s+([A-Z0-9]+(?:-[A-Z0-9]+)?)|(?:🚀|✅|⚠️|📌|🔒)\s*SESSION\s+([A-Z0-9]+(?:-[A-Z0-9]+)?)|SESSION[:\s]+([A-Z0-9-]+)|(HUB-\d+|SES-\d+|SESSION-\d+))\s*(.*)?$/i

  // ── Pattern Set 2: Bare SESSION lines (non-heading) ──────
  // Matches: SESSION 4A\nStatus: ...
  const bareSessionRegex = /^SESSION\s+([A-Z0-9]+(?:-[A-Z0-9]+)?)[\s\-—–:]*(.*)$/i

  // ── Pattern Set 3: HUB/SES prefixed standalone lines ─────
  const hubPrefixRegex = /^(?:#{1,4}\s+)?(HUB-\d+|SES-\d+|SESSION-\d+)(?:\s*[—\-–:]\s*(.+))?$/i

  // Build list of session block starts with their IDs
  type SessionBlock = { lineIdx: number; rawId: string; normId: string; headingLevel: number }
  const blockStarts: SessionBlock[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Match heading-based
    const headingMatch = line.match(sessionHeadingRegex)
    if (headingMatch) {
      const hLevel = headingMatch[1].length
      // Extract session ID from various capture groups
      const rawId = (headingMatch[2] || headingMatch[3] || headingMatch[4] || headingMatch[5] || '').trim()
      if (rawId) {
        const normId = normalizeSessionId(rawId)
        if (!seenIds.has(normId)) {
          seenIds.add(normId)
          blockStarts.push({ lineIdx: i, rawId, normId, headingLevel: hLevel })
        }
        continue
      }
    }

    // Match bare SESSION line (e.g. "SESSION 4A")
    const bareMatch = line.match(bareSessionRegex)
    if (bareMatch) {
      const rawId = bareMatch[1].trim()
      const normId = normalizeSessionId(rawId)
      if (!seenIds.has(normId)) {
        seenIds.add(normId)
        blockStarts.push({ lineIdx: i, rawId, normId, headingLevel: 0 })
      }
      continue
    }

    // Match HUB/SES prefixed lines
    const hubMatch = line.match(hubPrefixRegex)
    if (hubMatch) {
      const rawId = hubMatch[1].trim()
      const normId = normalizeSessionId(rawId)
      if (!seenIds.has(normId)) {
        seenIds.add(normId)
        blockStarts.push({ lineIdx: i, rawId, normId, headingLevel: line.startsWith('#') ? 1 : 0 })
      }
    }
  }

  // ── Process each session block ────────────────────────────
  for (let bi = 0; bi < blockStarts.length; bi++) {
    const block = blockStarts[bi]
    const nextBlock = blockStarts[bi + 1]

    // Determine block end: next session block OR 25 lines max OR next same/higher heading
    let endIdx = block.lineIdx + 25
    if (nextBlock) {
      endIdx = Math.min(endIdx, nextBlock.lineIdx)
    }
    endIdx = Math.min(endIdx, lines.length)

    const blockLines = lines.slice(block.lineIdx, endIdx)
    const blockText = blockLines.join('\n')

    // Extract title from heading line
    const headingLine = lines[block.lineIdx]
    const titleClean = headingLine
      .replace(/^#{1,4}\s+/, '')
      .replace(/SESSION\s+[A-Z0-9]+(?:-[A-Z0-9]+)?/i, '')
      .replace(/HUB-\d+|SES-\d+/i, '')
      .replace(/[🚀✅⚠️📌🔒—–\-:]+/, '')
      .trim()

    // ── Extract fields from block ─────────────────────────
    const provenance: Record<string, string> = {}

    // Status — multiple patterns
    let status_raw = 'unknown'
    let statusSource = 'not found in block'
    const statusPatterns = [
      /^STATUS[:\s]+(.+)$/im,
      /\bSTATUS[:\s]+(.+?)(?:\n|$)/i,
      /\bstatus[:\s]+(.+?)(?:\n|,|;|$)/i,
    ]
    for (const pat of statusPatterns) {
      const m = blockText.match(pat)
      if (m && m[1].trim() !== '') {
        status_raw = m[1].trim()
        statusSource = `line match: ${pat.source.slice(0, 30)}`
        break
      }
    }
    provenance['status'] = statusSource
    const status_norm = normalizeSovereignSessionStatus(status_raw)

    // Lane
    const laneMatch = blockText.match(/(?:lane|lajur)[:\s]+([^\n,|]+)/i)
    const lane = laneMatch ? laneMatch[1].trim() : undefined
    if (lane) provenance['lane'] = 'extracted from block text'

    // Objective
    const objMatch = blockText.match(/(?:objective|tujuan)[:\s]+([^\n]+)/i)
    const objective = objMatch ? objMatch[1].trim() : undefined
    if (objective) provenance['objective'] = 'extracted from block text'

    // Actual output
    const outputMatch = blockText.match(/(?:actual[_\s]output|delivered|output|hasil)[:\s]+([^\n]+)/i)
    const actual_output = outputMatch ? outputMatch[1].trim() : undefined

    // Blocker
    const blockerMatch = blockText.match(/blocker[_\s]?(?:type)?[:\s]+([^\n,|]+)/i)
    const blockerNoteMatch = blockText.match(/blocker[_\s]?note[:\s]+([^\n]+)/i)

    // Evidence links — only legitimate artifact URLs, NOT sensitive endpoints
    const allUrls = extractSafeEvidenceLinks(blockText)

    // Deploy state
    const deployStateText = blockText + ' ' + status_raw
    const deploy_state = normalizeDeployState(deployStateText)

    // Confidence for this session entry
    let sessionConf: SovereignConfidence = 'low'
    if (status_raw !== 'unknown') sessionConf = 'high'
    else if (objective || lane) sessionConf = 'medium'
    provenance['confidence_basis'] = `status=${status_raw !== 'unknown'}, objective=${!!objective}, lane=${!!lane}`

    sessions.push({
      session_id: block.normId,
      title: titleClean,
      status_raw,
      status_norm,
      objective,
      lane,
      deploy_state,
      actual_output,
      blocker_type: blockerMatch ? blockerMatch[1].trim().toLowerCase() : undefined,
      blocker_note: blockerNoteMatch ? blockerNoteMatch[1].trim() : undefined,
      evidence_links: allUrls,
      confidence: sessionConf,
      source_doc_id: docId,
      raw_trace: blockText.slice(0, 600),
      field_provenance: provenance
    })
  }

  if (sessions.length === 0) {
    warnings.push(
      'No session blocks detected. Expected patterns: "## SESSION 4G", "## 🚀 SESSION 4B", ' +
      '"HUB-17", "SES-01", or bare "SESSION 4A" lines. Check document structure.'
    )
  }

  return sessions
}

/** Normalize session ID to canonical form */
function normalizeSessionId(raw: string): string {
  const s = raw.toUpperCase().trim()
  // HUB-17 → HUB-17
  if (/^HUB-\d+$/.test(s)) return s
  // SES-01 → SES-01
  if (/^SES-\d+$/.test(s)) return s
  // 4G → SESSION-4G, 4A → SESSION-4A
  if (/^\d[A-Z]$/.test(s) || /^[A-Z]\d+[A-Z]?$/.test(s)) return `SESSION-${s}`
  // SESSION-4A already
  if (s.startsWith('SESSION-')) return s
  return s
}

/**
 * extractSafeEvidenceLinks — only safe/legitimate artifact URLs
 * HUB-19: Do NOT include:
 *   - tokenized webhook endpoints (contain random tokens/UUIDs in path)
 *   - API keys embedded in URLs
 *   - Cloudflare internal preview deploy hash URLs as "live URL"
 *   - URLs with ?: auth params
 *
 * DO include:
 *   - github.com repo and commit URLs
 *   - *.pages.dev production URLs
 *   - supabase.co project URLs (non-tokenized)
 */
function extractSafeEvidenceLinks(text: string): string[] {
  const urlPattern = /https?:\/\/[^\s<>"',)}\]]+/g
  const rawUrls = [...new Set(text.match(urlPattern) || [])]

  return rawUrls.filter(url => {
    // Block tokenized/sensitive patterns
    if (/[?&](token|key|secret|auth|apikey|api_key)=/i.test(url)) return false
    // Block wrangler internal worker previews with UUID-style hashes (but keep *.pages.dev domain roots)
    if (/[a-f0-9]{8,}\.pages\.dev/.test(url) && url.split('/').length <= 4) return false
    // Block URLs with long random path segments (likely tokens)
    const pathParts = new URL(url).pathname.split('/').filter(Boolean)
    if (pathParts.some(p => /^[a-f0-9-]{32,}$/.test(p))) return false
    // Allow github.com, *.pages.dev, known product domains
    return true
  })
}

/**
 * extractModuleTruth — extracts module/route status from doc.
 * Handles tables, bullet lists, inline mentions.
 */
export function extractModuleTruth(raw: string, docId: string, warnings: string[]): SovereignModuleTruth[] {
  const modules: SovereignModuleTruth[] = []
  const lines = raw.split('\n')

  const knownModules = [
    'dashboard', 'sessions', 'lanes', 'ecosystem', 'decisions',
    'prompt bridge', 'bridge', 'sovereign', 'auth', 'deployment',
    'chamber console', 'governance queue', 'supabase', 'health',
    'sovereign intake', 'closeout'
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase()

    for (const mod of knownModules) {
      if (line.includes(mod)) {
        const routeMatch = lines[i].match(/(\/[a-zA-Z0-9_\-/]+)/)
        const route = routeMatch ? routeMatch[1] : undefined

        const context = lines.slice(i, i + 3).join(' ')
        const statusMatch = context.match(/(?:✅|❌|⚠️|LIVE-VERIFIED|BUILD-VERIFIED|verified|blocked|live|partial)/i)
        const status_raw = statusMatch ? statusMatch[0].trim() : 'unknown'
        const status_norm = normalizeSovereignSessionStatus(status_raw)

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
 * extractGovernanceTruth — extracts governance canon, freeze, ops pack.
 *
 * HUB-19: Supports patterns:
 *   - GOVERNANCE CANON STATUS
 *   - Governance Canon v1 — FROZEN
 *   - Ops Pack COMMITTED
 *   - frozen docs count: N
 *   - commit refs
 */
export function extractGovernanceTruth(raw: string, docId: string, warnings: string[]): SovereignGovernanceTruth | null {
  const lower = raw.toLowerCase()

  const hasGovernance = lower.includes('governance') || lower.includes('canon') || lower.includes('freeze')
  if (!hasGovernance) return null

  // Canon status — explicit FROZEN check with multiple patterns
  let canon_status: SovereignGovernanceTruth['canon_status'] = 'unknown'
  if (
    lower.includes('frozen') ||
    lower.includes('canon') && lower.includes('frozen') ||
    lower.includes('governance canon') && lower.includes('frozen')
  ) {
    canon_status = 'frozen'
  } else if (lower.includes('canon') && (lower.includes('active') || lower.includes('live'))) {
    canon_status = 'active'
  } else if (lower.includes('canon') && lower.includes('pending')) {
    canon_status = 'pending'
  } else if (lower.includes('governance')) {
    canon_status = 'active'
  }

  // Governance pack
  const govPackMatch = raw.match(/governance[_\s]?(?:canon)?[_\s]?(?:pack|v\d+)?[:\s—–]+([^\n|,]+)/i)
  const governance_pack = govPackMatch ? govPackMatch[1].trim().replace(/\s*—\s*FROZEN.*/, '') : undefined

  // Freeze rules
  const freezeMatch = raw.match(/freeze[_\s]?rules?[:\s]+([^\n]+)/i)
  const freeze_rules = freezeMatch ? freezeMatch[1].trim() : undefined

  // Frozen docs count
  const frozenCountMatch = raw.match(/frozen\s+docs?\s+count[:\s]+(\d+)/i)
  const frozen_docs_count = frozenCountMatch ? parseInt(frozenCountMatch[1]) : undefined

  // Commit refs — lines with "commit" and a hash or ref
  const commitRefPattern = /commit(?:\s+ref)?[:\s]+([a-f0-9]{6,40}|[^\n]{5,60})/gi
  const commit_refs: string[] = []
  let commitMatch: RegExpExecArray | null
  while ((commitMatch = commitRefPattern.exec(raw)) !== null) {
    commit_refs.push(commitMatch[1].trim())
  }

  // Priority order
  const priority_order: string[] = []

  // Try "Priority Order:" block
  const priorityBlockMatch = raw.match(/priority[_\s]?order[:\s]*\n((?:[\s\S]*?)(?=\n\n|\n#|$))/i)
  if (priorityBlockMatch) {
    const pLines = priorityBlockMatch[1].split('\n')
    for (const pLine of pLines) {
      const clean = pLine.replace(/^[\d.\-*\s]+/, '').trim()
      if (clean.length > 2 && clean.length < 80 && !clean.startsWith('#')) {
        priority_order.push(clean)
      }
    }
  }

  // Also try inline "Priority Order: X, Y, Z"
  if (priority_order.length === 0) {
    const inlinePriorityMatch = raw.match(/priority[_\s]?order[:\s]+([^\n#]+)/i)
    if (inlinePriorityMatch) {
      inlinePriorityMatch[1].split(/[,;]/).forEach(item => {
        const clean = item.trim()
        if (clean.length > 1) priority_order.push(clean)
      })
    }
  }

  // Ops pack committed
  const ops_pack_committed = lower.includes('ops pack') &&
    (lower.includes('committed') || lower.includes('complete') || lower.includes('synced'))

  // Raw trace
  const govStart = lower.search(/governance\s+canon/i) >= 0
    ? lower.search(/governance\s+canon/i)
    : lower.indexOf('governance')
  const raw_trace = govStart >= 0 ? raw.slice(govStart, govStart + 600) : ''

  // HUB-19: is_immutable — frozen governance cannot be overridden
  const is_immutable = canon_status === 'frozen'

  return {
    canon_status,
    governance_pack,
    freeze_rules,
    frozen_docs_count,
    commit_refs,
    priority_order,
    ops_pack_committed,
    source_doc_id: docId,
    raw_trace,
    is_immutable
  }
}

/**
 * extractRepoTruth — extracts repo/deploy truth with URL sanitization.
 *
 * HUB-19: Supports patterns:
 *   - Repo: <url>
 *   - Production: <url>
 *   - Cloudflare: <host>
 *   - Live URL: <url>
 *   - GitHub: <url>
 *   - build_session: hubXX
 *
 * HUB-19: URL sanitization:
 *   - canonical_product_repo: GitHub repo URL only
 *   - canonical_ecosystem_repo: GitHub eco repo URL only
 *   - canonical_live_url: pages.dev production URL only
 *   - evidence_urls: list of safe artifact URLs
 *   - _restricted_endpoints_redacted: true (never render tokenized endpoints)
 */
function extractRepoTruth(raw: string, docId: string, warnings: string[]): SovereignRepoTruth | null {
  // ── Canonical product repo ────────────────────────────────
  const productRepoMatch = raw.match(/https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?:Lane-eco[^\s<>"]*)?/i)
  // Be more specific — look for the known product pattern
  const knownProductRepo = raw.match(/https:\/\/github\.com\/\w+\/(?:Lane-eco-budget[^\s<>"]*|[a-zA-Z0-9-]+budget[^\s<>"]*)/i)

  const ecoRepoMatch = raw.match(/https:\/\/github\.com\/\w+\/(?:Sovereign-ecosystem[^\s<>"]|[a-zA-Z0-9-]+ecosystem[^\s<>"]*)/i)

  // ── Live URL — look for explicit Repo:/Production:/Live URL: patterns ────
  const liveUrlPatterns = [
    /(?:production|live[_\s]?url|cloudflare)[:\s]+([^\s\n]+\.pages\.dev[^\s\n]*)/i,
    /(?:live[_\s]?url|deployed[_\s]?at)[:\s]+(https?:\/\/[^\s\n]+)/i,
    // standalone pages.dev URL NOT a preview hash
    /(https?:\/\/[a-z][a-z0-9-]*\.pages\.dev\/[^\s<>"]*)/i,
    /(https?:\/\/[a-z][a-z0-9-]*\.pages\.dev\/?)/i
  ]
  let canonical_live_url: string | undefined
  for (const pat of liveUrlPatterns) {
    const m = raw.match(pat)
    if (m) {
      const url = m[1].trim()
      // Filter: skip hash-prefixed preview URLs (8+ hex chars before .pages.dev)
      if (!/[a-f0-9]{8,}\.pages\.dev/.test(url)) {
        canonical_live_url = url
        break
      }
    }
  }

  // ── Repo: / GitHub: lines ────────────────────────────────
  const repoLineMatch = raw.match(/^(?:repo|github)[:\s]+(https?:\/\/[^\s\n]+)/im)
  const productRepoUrl = knownProductRepo?.[0] || repoLineMatch?.[1] || productRepoMatch?.[0]

  // ── Branch ───────────────────────────────────────────────
  const branchMatch = raw.match(/branch[:\s]+([^\s,|\n]+)/i)
  const branch = branchMatch ? branchMatch[1].trim() : 'main'

  // ── Build session ────────────────────────────────────────
  const buildSessMatch = raw.match(/build[_\s]?session[:\s]+([^\s,|\n]+)/i)
  const build_session = buildSessMatch ? buildSessMatch[1].trim() : undefined

  // ── Deploy state ─────────────────────────────────────────
  const lower = raw.toLowerCase()
  let deploy_state: SovereignDeployState = 'unknown'
  if (lower.includes('e2e') && lower.includes('verified')) deploy_state = 'e2e_verified'
  else if (lower.includes('live-verified') || lower.includes('live_verified') ||
           (lower.includes('live') && lower.includes('verified'))) deploy_state = 'live_verified'
  else if (lower.includes('build-verified') || lower.includes('build_verified') ||
           (lower.includes('build') && lower.includes('verified'))) deploy_state = 'build_verified'
  else if (lower.includes('repo-ready') || lower.includes('pushed')) deploy_state = 'repo_ready'
  else if (lower.includes('deploy') && lower.includes('blocked')) deploy_state = 'blocked'

  if (!productRepoUrl && !canonical_live_url) {
    warnings.push('No product repo or live URL found in document. Repo truth not extracted.')
    return null
  }

  // ── Last verified date ───────────────────────────────────
  const verifiedMatch = raw.match(/(?:verified|deployed)[^\n]*(\d{4}-\d{2}-\d{2})/i)
  const last_verified = verifiedMatch ? verifiedMatch[1] : undefined

  // ── Evidence URLs — safe artifacts only ─────────────────
  const evidence_urls = extractSafeEvidenceLinks(raw)
    .filter(url => url !== productRepoUrl && url !== canonical_live_url)
    .slice(0, 10)

  return {
    source_doc_id: docId,
    source_doc_type: 'current-handoff',
    canonical_product_repo: productRepoUrl,
    canonical_ecosystem_repo: ecoRepoMatch?.[0],
    canonical_live_url,
    evidence_urls,
    deploy_state,
    branch,
    last_verified,
    build_session,
    _restricted_endpoints_redacted: true
  }
}

/**
 * extractNextMoveTruth — extracts next locked move / next step.
 *
 * HUB-19: Supports patterns:
 *   - Next Session / Suggested scope
 *   - Next Locked Move
 *   - Pending Verification
 *   - Recommended next move
 *
 * Prioritizes explicit "next locked move" section.
 */
function extractNextMoveTruth(raw: string, docId: string, warnings: string[]): SovereignNextMoveTruth | null {
  // ── Pattern 1: Explicit "Next Locked Move" ───────────────
  const nlmHeadingMatch = raw.match(/(?:^#{1,4}\s+)?next[_\s]?locked[_\s]?move\s*[:\n]+([^\n#]{5,}(?:\n[^\n#]{0,80})?)/im)
  if (nlmHeadingMatch) {
    const text = nlmHeadingMatch[1].trim().split('\n')[0].trim()
    if (text.length > 5) {
      return {
        next_locked_move: text,
        confidence: 'high',
        source_doc_id: docId,
        raw_trace: nlmHeadingMatch[0].slice(0, 300)
      }
    }
  }

  // ── Pattern 2: "Suggested scope" (Next Session block) ────
  const suggestedMatch = raw.match(/suggested[_\s]?scope[:\s]+([^\n#]{5,})/i)

  // ── Pattern 3: "Pending Verification" ───────────────────
  const pendingMatch = raw.match(/pending[_\s]?verification[:\s]+([^\n#]{5,})/i)

  // ── Pattern 4: "Next step" / "Recommended next move" ─────
  const nextStepMatch = raw.match(
    /(?:next[_\s]?step|recommended[_\s]?next|action[_\s]?required|next[_\s]?action)[:\s]+([^\n#]{5,})/i
  )

  const best = suggestedMatch || nextStepMatch || pendingMatch
  if (best) {
    return {
      next_locked_move: best[1].trim(),
      suggested_scope: suggestedMatch?.[1].trim(),
      pending_verification: pendingMatch?.[1].trim(),
      confidence: 'medium',
      source_doc_id: docId,
      raw_trace: best[0].slice(0, 300)
    }
  }

  warnings.push('No explicit next locked move found. Check for "Next Locked Move:", "Suggested scope:", or "Next step:" sections.')
  return null
}

/**
 * extractSecretTruth — only detects secret readiness, NEVER extracts values.
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
      const idx = lower.indexOf(nameKey)
      const context = lower.slice(Math.max(0, idx - 100), idx + 200)

      let readiness: SovereignSecretTruth['readiness'] = 'missing'
      if (context.includes('not set') || context.includes("isn't set") || context.includes('missing')) readiness = 'missing'
      else if (context.includes('blocked') || context.includes('not available')) readiness = 'blocked'
      else if (context.includes('set') || context.includes('ready') || context.includes('configured')) readiness = 'ready'

      secrets.push({
        name: secret.name,
        purpose: secret.purpose,
        readiness,
        notes: `Detected in ${docId} — value NOT extracted (security guard active)`,
        source_doc_id: docId
      })
    }
  }

  return secrets
}

// ─── EVIDENCE-BASED CONFIDENCE SCORING (HUB-19) ──────────────

/**
 * computeConfidenceBreakdown — evidence-based scoring (HUB-19 spec B)
 *
 * Dimensions:
 *   1. valid_source_type detected
 *   2. session_blocks_found
 *   3. governance_found
 *   4. repo_deploy_found
 *   5. next_move_found
 *   6. module_truth_found
 *   7. conflicts_resolved_cleanly
 *
 * HIGH:   core truth domains extracted well (5+ dims met)
 * MEDIUM: partial but useful (3-4 dims met)
 * LOW:    source loaded but weakly parsed (1-2 dims)
 * NONE:   ingest accepted but unusable (0 dims)
 */
function computeConfidenceBreakdown(
  docType: SovereignDocType,
  sessions: SovereignSessionTruth[],
  modules: SovereignModuleTruth[],
  governance: SovereignGovernanceTruth | null,
  repo: SovereignRepoTruth | null,
  nextMove: SovereignNextMoveTruth | null,
  warnings: string[]
): ConfidenceBreakdown {
  const d = {
    valid_source_type: docType === 'current-handoff' || docType === 'active-priority',
    session_blocks_found: sessions.length > 0,
    governance_found: governance !== null && governance.canon_status !== 'unknown',
    repo_deploy_found: repo !== null && (!!repo.canonical_product_repo || !!repo.canonical_live_url),
    next_move_found: nextMove !== null && !!nextMove.next_locked_move,
    module_truth_found: modules.length > 0,
    conflicts_resolved_cleanly: warnings.filter(w => w.toLowerCase().includes('conflict')).length === 0
  }

  const met = Object.values(d).filter(Boolean).length
  const total = Object.keys(d).length

  let score_label: SovereignConfidence
  let truth_maturity: TruthMaturityLevel

  if (met >= 5) {
    score_label = 'high'
    truth_maturity = 'HIGH'
  } else if (met >= 3) {
    score_label = 'medium'
    truth_maturity = 'MEDIUM'
  } else if (met >= 1) {
    score_label = 'low'
    truth_maturity = 'LOW'
  } else {
    score_label = 'none'
    truth_maturity = 'NONE'
  }

  return {
    ...d,
    dimensions_met: met,
    total_dimensions: total,
    score_label,
    truth_maturity
  }
}

// ─── LAYER C: BRIDGE STORE SYNC ──────────────────────────────

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

  if (payload.source_meta.confidence === 'none') {
    return {
      synced_at: new Date().toISOString(),
      doc_id: payload.source_meta.doc_id,
      sessions_referenced: 0,
      governance_preserved: false,
      repo_synced: false,
      conflicts_detected: ['Source confidence is NONE — sync aborted. Ingest a real current-handoff doc.'],
      warnings
    }
  }

  const governance_preserved = payload.governance_truth !== null
    && payload.governance_truth.canon_status === 'frozen'

  const sessions_referenced = payload.session_truth.length
  const repo_synced = payload.repo_truth !== null && !!payload.repo_truth.canonical_live_url

  // Conflict detection
  for (const docSession of payload.session_truth) {
    if (docSession.status_norm === 'blocked' && docSession.deploy_state === 'live_verified') {
      conflicts.push(
        `Session ${docSession.session_id}: doc says BLOCKED but deploy_state is LIVE_VERIFIED — manual verification required`
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

// ─── LAYER D: PACK MERGE (HUB-19: EXPLICIT PROVENANCE) ───────

/**
 * MergedTruthContext — HUB-19 additions:
 *   - explicit unresolved field tracking
 *   - provenance labels (canonical_truth / merged_truth / controller_fallback / unresolved)
 *   - field_sources map
 *   - confidence_breakdown for UI truth-maturity badge
 */
export interface MergedTruthContext {
  // Provenance
  primary_source: string
  precedence: TruthPrecedence
  confidence: SovereignConfidence
  truth_maturity: TruthMaturityLevel
  confidence_breakdown: ConfidenceBreakdown | null
  merge_warnings: string[]

  // Merged fields
  session_status_override: SovereignStatusNorm | null
  deploy_state_override: SovereignDeployState | null
  governance_frozen: boolean
  governance_is_immutable: boolean
  canon_status: string
  freeze_rules_override: string | null
  priority_order: string[]
  next_locked_move: string | null
  next_locked_move_confidence: SovereignConfidence | null
  evidence_links_supplement: string[]

  // Repo supplement — safe URLs only (HUB-19 D)
  repo_supplement: {
    product_repo: string
    ecosystem_repo: string
    live_url: string | null
    deploy_state: SovereignDeployState
    // provenance labels
    product_repo_source: string
    live_url_source: string
    deploy_state_source: string
  }

  // HUB-19 E: Fallback rendering honesty
  unresolved_fields: string[]        // fields that could not be resolved
  controller_fallback_fields: string[] // fields using P3 fallback
  field_sources: Record<string, string> // field → truth level label

  conflicts: string[]
  conflict_resolutions: string[]

  // HUB-19 F: Extraction completeness for UI
  extraction_completeness: {
    sessions_found: number
    modules_found: number
    governance_found: boolean
    next_move_found: boolean
    repo_truth_found: boolean
  }
}

/**
 * mergeSovereignTruthWithControllerState(sovereignPayload, controllerSessionId)
 *
 * HUB-19: Upgraded merge — P1 truth actually influences pack output.
 * Every field has explicit provenance label:
 *   - canonical_truth (P1/P2)
 *   - controller_fallback (P3)
 *   - repo_runtime (P4)
 *   - unresolved (null without explanation replaced with honest labels)
 */
export function mergeSovereignTruthWithControllerState(
  sovereignPayload: SovereignIntakePayload | null,
  controllerSessionId?: string
): MergedTruthContext {
  const conflicts: string[] = []
  const resolutions: string[] = []
  const unresolved: string[] = []
  const controllerFallback: string[] = []
  const fieldSources: Record<string, string> = {}

  const KNOWN_PRODUCT_REPO = 'https://github.com/ganihypha/Lane-eco-budget-control-system'
  const KNOWN_ECO_REPO = 'https://github.com/ganihypha/Sovereign-ecosystem'
  const KNOWN_LIVE_URL = 'https://lane-eco-budget-control.pages.dev/'

  // ── DEFAULT: no sovereign source — honest P3-only output ────
  if (!sovereignPayload) {
    const unresolvedFields = [
      'session_status_override',
      'deploy_state_override',
      'governance_frozen',
      'canon_status',
      'priority_order',
      'next_locked_move'
    ]
    unresolvedFields.forEach(f => {
      unresolved.push(f)
      fieldSources[f] = 'unresolved — not found in canonical source (no P1 ingested)'
    })
    controllerFallback.push('repo_supplement.product_repo', 'repo_supplement.live_url', 'repo_supplement.deploy_state')
    fieldSources['repo_supplement.product_repo'] = 'controller_fallback (P3 hardcoded)'
    fieldSources['repo_supplement.live_url'] = 'controller_fallback (P3 hardcoded)'

    return {
      primary_source: 'Controller (P3) — no sovereign source ingested',
      precedence: 'P3',
      confidence: 'low',
      truth_maturity: 'LOW',
      confidence_breakdown: null,
      merge_warnings: [
        'No P1/P2 sovereign source ingested. Pack grounded in controller state only (P3).',
        'Ingest a current-handoff document at /sovereign to raise confidence to HIGH.'
      ],
      session_status_override: null,
      deploy_state_override: null,
      governance_frozen: false,
      governance_is_immutable: false,
      canon_status: 'unresolved — not found in canonical source',
      freeze_rules_override: null,
      priority_order: [],
      next_locked_move: null,
      next_locked_move_confidence: null,
      evidence_links_supplement: [],
      repo_supplement: {
        product_repo: KNOWN_PRODUCT_REPO,
        ecosystem_repo: KNOWN_ECO_REPO,
        live_url: KNOWN_LIVE_URL,
        deploy_state: 'live_verified',
        product_repo_source: 'controller_fallback (P3 hardcoded)',
        live_url_source: 'controller_fallback (P3 hardcoded)',
        deploy_state_source: 'controller_fallback (P3 hardcoded)'
      },
      unresolved_fields: unresolved,
      controller_fallback_fields: controllerFallback,
      field_sources: fieldSources,
      conflicts: [],
      conflict_resolutions: [],
      extraction_completeness: {
        sessions_found: 0,
        modules_found: 0,
        governance_found: false,
        next_move_found: false,
        repo_truth_found: false
      }
    }
  }

  const meta = sovereignPayload.source_meta
  const governance = sovereignPayload.governance_truth
  const repo = sovereignPayload.repo_truth
  const nextMove = sovereignPayload.next_move_truth

  // ── Session-specific merge ───────────────────────────────
  let sessionStatusOverride: SovereignStatusNorm | null = null
  let deployStateOverride: SovereignDeployState | null = null
  const evidenceLinks: string[] = []

  if (controllerSessionId) {
    const docSession = sovereignPayload.session_truth.find(
      s => s.session_id === controllerSessionId.toUpperCase() ||
           s.session_id === `SESSION-${controllerSessionId.toUpperCase()}`
    )
    if (docSession) {
      sessionStatusOverride = docSession.status_norm
      deployStateOverride = docSession.deploy_state
      evidenceLinks.push(...docSession.evidence_links)
      fieldSources['session_status_override'] = `canonical_truth (P1 — ${docSession.source_doc_id})`
      fieldSources['deploy_state_override'] = `canonical_truth (P1 — ${docSession.source_doc_id})`
    } else {
      unresolved.push('session_status_override')
      fieldSources['session_status_override'] = `unresolved — session ${controllerSessionId} not found in P1 source`
      controllerFallback.push('session_status_override')
    }
  } else {
    unresolved.push('session_status_override (no session_id requested)')
    fieldSources['session_status_override'] = 'unresolved — no session_id provided to merge call'
  }

  // ── Governance — P1 immutable if frozen ──────────────────
  const governance_frozen = governance?.canon_status === 'frozen'
  const governance_is_immutable = governance?.is_immutable === true

  if (governance_frozen) {
    resolutions.push('Governance Canon v1 frozen — immutable, cannot be overridden by P2/P3/P4/P5')
    fieldSources['canon_status'] = `canonical_truth (P1 — immutable frozen)`
    fieldSources['governance_frozen'] = `canonical_truth (P1 — FROZEN)`
  } else if (governance) {
    fieldSources['canon_status'] = `canonical_truth (P1 — ${governance.source_doc_id})`
  } else {
    unresolved.push('canon_status')
    fieldSources['canon_status'] = 'unresolved — no governance section in P1 source'
  }

  // Priority order
  const priority_order = governance?.priority_order || []
  if (priority_order.length > 0) {
    fieldSources['priority_order'] = `canonical_truth (P1 — ${governance?.source_doc_id})`
  } else {
    unresolved.push('priority_order')
    fieldSources['priority_order'] = 'unresolved — not found in canonical source'
  }

  // ── Next locked move ─────────────────────────────────────
  const next_locked_move = nextMove?.next_locked_move || null
  const next_locked_move_confidence = nextMove?.confidence || null

  if (next_locked_move) {
    fieldSources['next_locked_move'] = `canonical_truth (P1 — confidence: ${next_locked_move_confidence})`
  } else {
    unresolved.push('next_locked_move')
    fieldSources['next_locked_move'] = 'unresolved — not found in canonical source (P1)'
  }

  // ── Repo supplement — with explicit source provenance ────
  const productRepo = repo?.canonical_product_repo || null
  const ecoRepo = repo?.canonical_ecosystem_repo || null
  const liveUrl = repo?.canonical_live_url || null
  const deployState = repo?.deploy_state || 'unknown'

  // Product repo
  let repoSource = 'unresolved'
  if (productRepo) {
    fieldSources['repo_supplement.product_repo'] = `canonical_truth (P1 — ${repo?.source_doc_id})`
    repoSource = `canonical_truth (P1)`
  } else {
    controllerFallback.push('repo_supplement.product_repo')
    fieldSources['repo_supplement.product_repo'] = 'controller_fallback (P3 hardcoded)'
    repoSource = 'controller_fallback (P3 hardcoded)'
  }

  // Live URL
  let liveUrlSource: string
  if (liveUrl) {
    fieldSources['repo_supplement.live_url'] = `canonical_truth (P1 — ${repo?.source_doc_id})`
    liveUrlSource = `canonical_truth (P1)`
  } else {
    controllerFallback.push('repo_supplement.live_url')
    fieldSources['repo_supplement.live_url'] = 'controller_fallback (P3 hardcoded)'
    liveUrlSource = 'controller_fallback (P3 hardcoded)'
  }

  // Deploy state
  let deployStateSource: string
  if (deployState !== 'unknown') {
    fieldSources['repo_supplement.deploy_state'] = `canonical_truth (P1 — ${repo?.source_doc_id})`
    deployStateSource = `canonical_truth (P1)`
  } else {
    controllerFallback.push('repo_supplement.deploy_state')
    fieldSources['repo_supplement.deploy_state'] = 'controller_fallback (P3 assumed live_verified)'
    deployStateSource = 'controller_fallback (P3)'
    if (deployStateOverride) {
      fieldSources['repo_supplement.deploy_state'] = `canonical_truth (P1 session override: ${deployStateOverride})`
      deployStateSource = `canonical_truth (P1)`
    }
  }

  // ── Conflict detection ───────────────────────────────────
  if (sessionStatusOverride === 'blocked' && deployStateOverride === 'live_verified') {
    conflicts.push('Session status says BLOCKED but deploy_state is LIVE_VERIFIED — manual review required')
    resolutions.push('Prefer deploy_state=live_verified as evidence over status text (P4 evidence > P5 text)')
  }

  // ── Final merge result ────────────────────────────────────
  return {
    primary_source: `${meta.source_label} (${meta.precedence} — ${meta.safe_source_id})`,
    precedence: meta.precedence,
    confidence: meta.confidence,
    truth_maturity: meta.confidence_breakdown?.truth_maturity || 'LOW',
    confidence_breakdown: meta.confidence_breakdown,
    merge_warnings: meta.parse_warnings,
    session_status_override: sessionStatusOverride,
    deploy_state_override: deployStateOverride || (repo?.deploy_state !== 'unknown' ? repo?.deploy_state || null : null),
    governance_frozen,
    governance_is_immutable,
    canon_status: governance?.canon_status || 'unresolved — not found in canonical source',
    freeze_rules_override: governance?.freeze_rules || null,
    priority_order,
    next_locked_move,
    next_locked_move_confidence,
    evidence_links_supplement: [...new Set(evidenceLinks)],
    repo_supplement: {
      product_repo: productRepo || KNOWN_PRODUCT_REPO,
      ecosystem_repo: ecoRepo || KNOWN_ECO_REPO,
      live_url: liveUrl || KNOWN_LIVE_URL,
      deploy_state: deployState !== 'unknown' ? deployState : 'live_verified',
      product_repo_source: repoSource,
      live_url_source: liveUrlSource,
      deploy_state_source: deployStateSource
    },
    unresolved_fields: unresolved,
    controller_fallback_fields: controllerFallback,
    field_sources: fieldSources,
    conflicts,
    conflict_resolutions: resolutions,
    extraction_completeness: {
      sessions_found: sovereignPayload.session_truth.length,
      modules_found: sovereignPayload.module_truth.length,
      governance_found: governance !== null,
      next_move_found: next_locked_move !== null,
      repo_truth_found: repo !== null
    }
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
  truth_maturity: TruthMaturityLevel
  confidence_breakdown: ConfidenceBreakdown | null
  ingested_at: string | null
  parse_warnings: string[]
  // HUB-19: safe display fields
  safe_source_id: string | null
  // HUB-20: persistence diagnostics
  storage_mode: StorageMode
  active_source_restored_on_boot: boolean
  boot_restore_note: string
}

export function getSovereignIntakeSummary(): SovereignIntakeSummary {
  const active = sovereignStore.getActive()
  const bootStatus = sovereignStore.getBootStatus()
  const storageMode = sovereignStore.getStorageMode()

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
      truth_maturity: 'NONE',
      confidence_breakdown: null,
      ingested_at: null,
      parse_warnings: ['No sovereign source ingested. Pack grounded in controller state only (P3).'],
      safe_source_id: null,
      // HUB-20: persistence diagnostics
      storage_mode: storageMode,
      active_source_restored_on_boot: bootStatus.restored,
      boot_restore_note: bootStatus.note
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
    truth_maturity: active.source_meta.confidence_breakdown?.truth_maturity || 'LOW',
    confidence_breakdown: active.source_meta.confidence_breakdown || null,
    ingested_at: active.source_meta.ingested_at,
    parse_warnings: active.source_meta.parse_warnings,
    safe_source_id: active.source_meta.safe_source_id,
    // HUB-20: persistence diagnostics
    storage_mode: storageMode,
    active_source_restored_on_boot: bootStatus.restored,
    boot_restore_note: bootStatus.note
  }
}
