// ============================================================
// SOVEREIGN INTAKE D1 PERSISTENCE ADAPTER
// HUB-20: Persistent Sovereign Intake Storage
//
// Purpose: Replace volatile in-memory sovereign store with
//          persistent D1-backed storage. Survives restart/redeploy.
//
// Architecture:
//   - SovereignDBAdapter: wraps D1Database binding
//   - Graceful fallback: if D1 unavailable → in-memory + honest warning
//   - Auto-restore: on app boot, restores most recent valid P1/P2 source
//   - Storage mode exposed: "persistent" | "in-memory" | "degraded"
//
// Spec compliance (from truth.mature.m.implmntdd):
//   1. PERSISTENT SOVEREIGN INTAKE STORAGE
//   2. AUTO-RESTORE ACTIVE P1 SOURCE ON BOOT
//   3. HARDEN MERGE HONESTY
//   4. CLEAN UP LOW-TRUST DEFAULTS
//   5. SUMMARY + DIAGNOSTICS UPGRADE
//   6. DO NOT ADD LLM DEPENDENCY AS PRIMARY FIX
//
// NON-GOALS:
//   - Do NOT rebuild Budget Controller
//   - Do NOT create duplicate source of truth
//   - Do NOT use LLM as truth authority
// ============================================================

import type {
  SovereignIntakePayload,
  SovereignDocType,
  TruthPrecedence,
  SovereignConfidence,
  TruthMaturityLevel,
} from './sovereign'

// ─── STORAGE MODE ────────────────────────────────────────────

export type StorageMode = 'persistent' | 'in-memory' | 'degraded'

export interface BootRestoreResult {
  restored: boolean
  restored_doc_id: string | null
  restored_precedence: TruthPrecedence | null
  storage_mode: StorageMode
  note: string
}

// ─── D1 PERSISTENCE ADAPTER ──────────────────────────────────

/**
 * SovereignDBAdapter
 *
 * Wraps Cloudflare D1Database to persist sovereign intake records.
 * Falls back to in-memory if D1 is not bound or unavailable.
 *
 * Usage:
 *   const adapter = new SovereignDBAdapter(env.SOVEREIGN_DB)
 *   await adapter.savePayload(payload, rawContent)
 *   const active = await adapter.restoreActiveSource()
 */
export class SovereignDBAdapter {
  private db: D1Database | null
  public storageMode: StorageMode
  public lastError: string | null = null

  constructor(db: D1Database | null | undefined) {
    this.db = db ?? null
    this.storageMode = db ? 'persistent' : 'in-memory'
  }

  // ── Save payload to D1 ──────────────────────────────────────

  async savePayload(payload: SovereignIntakePayload, rawContent: string = ''): Promise<void> {
    if (!this.db) {
      this.storageMode = 'in-memory'
      return // silently use in-memory (handled by in-memory store)
    }

    try {
      const meta = payload.source_meta
      // Cap raw content at 64KB to stay within D1 row limits
      const cappedRaw = rawContent.length > 65536 ? rawContent.slice(0, 65536) : rawContent

      await this.db.prepare(`
        INSERT OR REPLACE INTO sovereign_intake_records (
          id, doc_type, precedence, source_label, raw_length,
          ingested_at, confidence, truth_maturity, parse_warnings,
          confidence_breakdown, session_truth, module_truth, secret_truth,
          governance_truth, repo_truth, next_move_truth, merge_meta,
          raw_content, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, datetime('now')
        )
      `).bind(
        meta.doc_id,
        meta.doc_type,
        meta.precedence,
        meta.source_label,
        meta.raw_length,
        meta.ingested_at,
        meta.confidence,
        meta.confidence_breakdown?.truth_maturity ?? 'NONE',
        JSON.stringify(meta.parse_warnings),
        JSON.stringify(meta.confidence_breakdown ?? {}),
        JSON.stringify(payload.session_truth),
        JSON.stringify(payload.module_truth),
        JSON.stringify(payload.secret_truth),
        JSON.stringify(payload.governance_truth),
        JSON.stringify(payload.repo_truth),
        JSON.stringify(payload.next_move_truth),
        JSON.stringify(payload.merge_meta),
        cappedRaw
      ).run()

      this.storageMode = 'persistent'
    } catch (err: any) {
      this.lastError = `D1 savePayload error: ${err?.message ?? String(err)}`
      this.storageMode = 'degraded'
      // Don't throw — graceful degradation to in-memory
    }
  }

  // ── Set active source pointer ────────────────────────────────

  async setActiveSource(docId: string): Promise<void> {
    if (!this.db) return
    try {
      await this.db.prepare(`
        UPDATE sovereign_active_source
        SET active_doc_id = ?, set_at = datetime('now'), storage_mode = 'persistent'
        WHERE id = 1
      `).bind(docId).run()
    } catch (err: any) {
      this.lastError = `D1 setActiveSource error: ${err?.message ?? String(err)}`
    }
  }

  // ── Restore active P1 source on boot ────────────────────────

  /**
   * restoreActiveSource()
   *
   * Called on app boot. Attempts to restore the most recent valid
   * P1 (or P2) source from D1 persistent storage.
   *
   * Restore conditions (spec requirement):
   *   - precedence is P1 or P2
   *   - normalized payload exists (session_truth or repo_truth)
   *   - source passed minimum validity: confidence != 'none'
   *
   * If restore fails → honest warning state, never silent downgrade.
   */
  async restoreActiveSource(): Promise<{ payload: SovereignIntakePayload | null; result: BootRestoreResult }> {
    if (!this.db) {
      const result: BootRestoreResult = {
        restored: false,
        restored_doc_id: null,
        restored_precedence: null,
        storage_mode: 'in-memory',
        note: 'D1 not bound — using in-memory storage. Sovereign source will not persist across restarts.'
      }
      return { payload: null, result }
    }

    try {
      // 1. Check if we have an explicit active_doc_id pointer
      const activeRow = await this.db.prepare(
        `SELECT active_doc_id FROM sovereign_active_source WHERE id = 1`
      ).first<{ active_doc_id: string | null }>()

      let targetDocId: string | null = activeRow?.active_doc_id ?? null

      // 2. If no explicit pointer, find most recent valid P1/P2 record
      if (!targetDocId) {
        const recent = await this.db.prepare(`
          SELECT id FROM sovereign_intake_records
          WHERE precedence IN ('P1', 'P2')
            AND confidence != 'none'
            AND (
              session_truth != '[]' OR
              repo_truth != 'null' OR
              governance_truth != 'null'
            )
          ORDER BY ingested_at DESC
          LIMIT 1
        `).first<{ id: string }>()
        targetDocId = recent?.id ?? null
      }

      if (!targetDocId) {
        // Log boot with no restore
        await this._logBoot(false, null, null, 'persistent', 'No valid P1/P2 source found in D1')
        const result: BootRestoreResult = {
          restored: false,
          restored_doc_id: null,
          restored_precedence: null,
          storage_mode: 'persistent',
          note: 'No valid P1/P2 source found in persistent storage. Ingest a current-handoff to activate sovereign grounding.'
        }
        return { payload: null, result }
      }

      // 3. Fetch full record
      const row = await this.db.prepare(
        `SELECT * FROM sovereign_intake_records WHERE id = ?`
      ).bind(targetDocId).first<D1SovereignRecord>()

      if (!row) {
        await this._logBoot(false, targetDocId, null, 'degraded', `D1 record not found for doc_id: ${targetDocId}`)
        const result: BootRestoreResult = {
          restored: false,
          restored_doc_id: targetDocId,
          restored_precedence: null,
          storage_mode: 'degraded',
          note: `D1 record missing for active_doc_id ${targetDocId}. Storage may be degraded.`
        }
        return { payload: null, result }
      }

      // 4. Reconstruct payload from D1 row
      const payload = this._rowToPayload(row)

      if (!payload) {
        await this._logBoot(false, targetDocId, null, 'degraded', 'Failed to parse D1 record into payload')
        const result: BootRestoreResult = {
          restored: false,
          restored_doc_id: targetDocId,
          restored_precedence: null,
          storage_mode: 'degraded',
          note: 'Stored D1 record could not be deserialized. Re-ingest required.'
        }
        return { payload: null, result }
      }

      // 5. Update active pointer + log boot restore
      await this.setActiveSource(targetDocId)
      await this._logBoot(
        true, targetDocId,
        payload.source_meta.precedence,
        'persistent',
        `P1 source restored: ${targetDocId} (confidence: ${payload.source_meta.confidence}, maturity: ${payload.source_meta.confidence_breakdown?.truth_maturity ?? 'unknown'})`
      )

      const result: BootRestoreResult = {
        restored: true,
        restored_doc_id: targetDocId,
        restored_precedence: payload.source_meta.precedence,
        storage_mode: 'persistent',
        note: `Auto-restored ${payload.source_meta.precedence} source: ${targetDocId}. Truth maturity: ${payload.source_meta.confidence_breakdown?.truth_maturity ?? 'UNKNOWN'}`
      }

      return { payload, result }

    } catch (err: any) {
      this.lastError = `D1 restoreActiveSource error: ${err?.message ?? String(err)}`
      this.storageMode = 'degraded'

      const result: BootRestoreResult = {
        restored: false,
        restored_doc_id: null,
        restored_precedence: null,
        storage_mode: 'degraded',
        note: `D1 restore failed: ${this.lastError}. System operating in degraded mode — no sovereign source active.`
      }
      return { payload: null, result }
    }
  }

  // ── Get payload by doc_id ────────────────────────────────────

  async getPayload(docId: string): Promise<SovereignIntakePayload | null> {
    if (!this.db) return null
    try {
      const row = await this.db.prepare(
        `SELECT * FROM sovereign_intake_records WHERE id = ?`
      ).bind(docId).first<D1SovereignRecord>()
      return row ? this._rowToPayload(row) : null
    } catch {
      return null
    }
  }

  // ── List all payloads ────────────────────────────────────────

  async listPayloads(): Promise<SovereignIntakePayload[]> {
    if (!this.db) return []
    try {
      const { results } = await this.db.prepare(`
        SELECT * FROM sovereign_intake_records
        ORDER BY ingested_at DESC
        LIMIT 20
      `).all<D1SovereignRecord>()
      return results.map(r => this._rowToPayload(r)).filter((p): p is SovereignIntakePayload => p !== null)
    } catch {
      return []
    }
  }

  // ── Get raw content ──────────────────────────────────────────

  async getRawContent(docId: string): Promise<string | null> {
    if (!this.db) return null
    try {
      const row = await this.db.prepare(
        `SELECT raw_content FROM sovereign_intake_records WHERE id = ?`
      ).bind(docId).first<{ raw_content: string }>()
      return row?.raw_content ?? null
    } catch {
      return null
    }
  }

  // ── Clear all records ────────────────────────────────────────

  async clearAll(): Promise<void> {
    if (!this.db) return
    try {
      await this.db.prepare(`DELETE FROM sovereign_intake_records`).run()
      await this.db.prepare(
        `UPDATE sovereign_active_source SET active_doc_id = NULL WHERE id = 1`
      ).run()
    } catch (err: any) {
      this.lastError = `D1 clearAll error: ${err?.message ?? String(err)}`
    }
  }

  // ── Boot log helper ──────────────────────────────────────────

  private async _logBoot(
    restored: boolean,
    docId: string | null,
    precedence: string | null,
    mode: StorageMode,
    note: string
  ): Promise<void> {
    if (!this.db) return
    try {
      await this.db.prepare(`
        INSERT INTO sovereign_boot_log (restored, restored_doc_id, restored_precedence, storage_mode, note)
        VALUES (?, ?, ?, ?, ?)
      `).bind(restored ? 1 : 0, docId, precedence, mode, note).run()
    } catch {
      // Non-critical — don't surface boot log errors
    }
  }

  // ── Row → Payload deserialization ────────────────────────────

  private _rowToPayload(row: D1SovereignRecord): SovereignIntakePayload | null {
    try {
      const confidenceBreakdown = this._safeParse(row.confidence_breakdown, {})
      const governanceTruth = this._safeParse(row.governance_truth, null)
      const repoTruth = this._safeParse(row.repo_truth, null)
      const nextMoveTruth = this._safeParse(row.next_move_truth, null)

      return {
        source_meta: {
          doc_id: row.id,
          doc_type: row.doc_type as SovereignDocType,
          source_label: row.source_label,
          precedence: row.precedence as TruthPrecedence,
          raw_length: row.raw_length ?? 0,
          ingested_at: row.ingested_at,
          confidence: row.confidence as SovereignConfidence,
          confidence_breakdown: Object.keys(confidenceBreakdown).length > 0 ? confidenceBreakdown : null,
          parse_warnings: this._safeParse(row.parse_warnings, []),
          safe_source_id: row.id   // doc_id only — never a URL
        },
        session_truth: this._safeParse(row.session_truth, []),
        module_truth: this._safeParse(row.module_truth, []),
        secret_truth: this._safeParse(row.secret_truth, []),
        governance_truth: governanceTruth,
        repo_truth: repoTruth,
        next_move_truth: nextMoveTruth,
        merge_meta: this._safeParse(row.merge_meta, null)
      }
    } catch {
      return null
    }
  }

  private _safeParse<T>(json: string, fallback: T): T {
    try {
      if (!json || json === 'null' || json === 'undefined') return fallback
      return JSON.parse(json) ?? fallback
    } catch {
      return fallback
    }
  }
}

// ─── D1 ROW TYPE ─────────────────────────────────────────────

interface D1SovereignRecord {
  id: string
  doc_type: string
  precedence: string
  source_label: string
  raw_length: number
  ingested_at: string
  confidence: string
  truth_maturity: string
  parse_warnings: string
  confidence_breakdown: string
  session_truth: string
  module_truth: string
  secret_truth: string
  governance_truth: string
  repo_truth: string
  next_move_truth: string
  merge_meta: string
  raw_content: string
  created_at: string
  updated_at: string
}
