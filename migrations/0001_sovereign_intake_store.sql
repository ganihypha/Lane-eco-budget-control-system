-- ============================================================
-- Sovereign Intake Persistent Store
-- HUB-20: Persistent Sovereign Intake Storage (D1)
-- 
-- Purpose: Replace volatile in-memory sovereign store with
--          persistent D1-backed storage that survives restart/redeploy.
--
-- Truth Precedence: P1 current-handoff → P2 active-priority →
--                   P3 controller state → P4 repo → P5 notes
-- ============================================================

-- Main sovereign intake records table
CREATE TABLE IF NOT EXISTS sovereign_intake_records (
  id               TEXT PRIMARY KEY,           -- doc_id (safe_source_id)
  doc_type         TEXT NOT NULL,              -- current-handoff | active-priority | unknown
  precedence       TEXT NOT NULL,              -- P1 | P2 | P3 | P4 | P5
  source_label     TEXT NOT NULL,              -- human-readable label
  raw_length       INTEGER DEFAULT 0,
  ingested_at      TEXT NOT NULL,              -- ISO timestamp
  confidence       TEXT NOT NULL,              -- high | medium | low | none
  truth_maturity   TEXT NOT NULL DEFAULT 'NONE', -- HIGH | MEDIUM | LOW | NONE
  parse_warnings   TEXT DEFAULT '[]',          -- JSON array
  -- confidence_breakdown stored as JSON
  confidence_breakdown TEXT DEFAULT '{}',
  -- normalized payload domains stored as JSON (compact)
  session_truth    TEXT DEFAULT '[]',          -- JSON array of SovereignSessionTruth
  module_truth     TEXT DEFAULT '[]',          -- JSON array of SovereignModuleTruth
  secret_truth     TEXT DEFAULT '[]',          -- JSON array of SovereignSecretTruth
  governance_truth TEXT DEFAULT 'null',        -- JSON or null
  repo_truth       TEXT DEFAULT 'null',        -- JSON or null
  next_move_truth  TEXT DEFAULT 'null',        -- JSON or null
  merge_meta       TEXT DEFAULT 'null',        -- JSON or null
  -- raw content — stored for re-parse on demand
  raw_content      TEXT DEFAULT '',            -- original markdown (capped at 64KB)
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Active source pointer table — tracks which doc is P1
CREATE TABLE IF NOT EXISTS sovereign_active_source (
  id               INTEGER PRIMARY KEY CHECK (id = 1), -- singleton row
  active_doc_id    TEXT,                              -- FK to sovereign_intake_records.id
  set_at           TEXT NOT NULL DEFAULT (datetime('now')),
  restored_on_boot INTEGER DEFAULT 0,                 -- 1 if restored from DB on boot
  storage_mode     TEXT DEFAULT 'persistent'          -- persistent | in-memory | degraded
);

-- Boot restore audit log
CREATE TABLE IF NOT EXISTS sovereign_boot_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  boot_at        TEXT NOT NULL DEFAULT (datetime('now')),
  restored       INTEGER NOT NULL DEFAULT 0,          -- 1 = P1 restored, 0 = no source found
  restored_doc_id TEXT,                               -- doc_id if restored
  restored_precedence TEXT,                           -- P1 | P2 etc
  storage_mode   TEXT NOT NULL DEFAULT 'persistent',
  note           TEXT
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_sovereign_records_precedence ON sovereign_intake_records(precedence);
CREATE INDEX IF NOT EXISTS idx_sovereign_records_ingested ON sovereign_intake_records(ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_sovereign_records_confidence ON sovereign_intake_records(confidence);

-- Initialize singleton active source row (if not exists)
INSERT OR IGNORE INTO sovereign_active_source (id, active_doc_id, storage_mode)
VALUES (1, NULL, 'persistent');
