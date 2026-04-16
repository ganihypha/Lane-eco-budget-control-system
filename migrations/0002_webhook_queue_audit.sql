-- ============================================================
-- Webhook Log + Queue Audit Durable Storage
-- HUB-23: Durable audit persistence for webhook events and queue items
--
-- Purpose:
--   Replace ephemeral in-memory webhook log and batch queue with
--   D1-backed durable storage that survives Cloudflare Worker
--   instance changes, cold starts, and redeployments.
--
-- Design:
--   webhook_audit_log   — immutable append-only log of all inbound events
--   queue_audit_items   — queue items with full status_history trace
--
-- Security:
--   NEVER store raw token values or secret values.
--   token_result stores only the classification enum (VALIDATED / INVALID_TOKEN / etc.)
-- ============================================================

-- ── TABLE: webhook_audit_log ─────────────────────────────────
-- Immutable append-only log of all inbound webhook events.
-- Survives instance changes. Max retention: 500 most recent events.
CREATE TABLE IF NOT EXISTS webhook_audit_log (
  id                    TEXT PRIMARY KEY,   -- event_id (wh-timestamp-random)
  received_at           TEXT NOT NULL,      -- ISO timestamp
  event_type            TEXT NOT NULL,      -- e.g. budget.approval
  source                TEXT NOT NULL,      -- e.g. external-caller
  payload_keys          TEXT DEFAULT '[]',  -- JSON array of keys (no values)
  token_result          TEXT NOT NULL,      -- VALIDATED | INVALID_TOKEN | MISSING_TOKEN | SECRET_NOT_CONFIGURED
  token_note            TEXT DEFAULT '',    -- human-readable classification note
  validation_status     TEXT NOT NULL,      -- accepted | rejected
  queue_handoff         TEXT NOT NULL,      -- accepted | rejected
  queue_handoff_note    TEXT DEFAULT '',    -- queue handoff note
  processing_decision   TEXT DEFAULT '',    -- final decision label
  final_status          TEXT DEFAULT '',    -- LIVE_VERIFIED | PARTIAL | REJECTED
  verification_level    TEXT DEFAULT ''     -- full verification level string
);

-- Index for fast recent-event queries
CREATE INDEX IF NOT EXISTS idx_webhook_log_received_at
  ON webhook_audit_log(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_log_token_result
  ON webhook_audit_log(token_result);


-- ── TABLE: queue_audit_items ──────────────────────────────────
-- Durable queue items with full audit trace.
-- Distinguishes real webhook events from test items.
-- Survives instance changes.
CREATE TABLE IF NOT EXISTS queue_audit_items (
  event_id              TEXT PRIMARY KEY,   -- matches webhook event_id
  event_type            TEXT NOT NULL,
  source                TEXT NOT NULL,
  origin                TEXT NOT NULL,      -- webhook_inbound | test_scenario | direct_ingest
  received_at           TEXT NOT NULL,      -- ISO timestamp
  current_status        TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | approved | sent | failed
  processed_at          TEXT,              -- ISO timestamp when final status reached
  failure_reason        TEXT,              -- populated if status=failed
  -- status_history stored as JSON array: [{status, at, note}, ...]
  status_history        TEXT DEFAULT '[]',
  -- audit_trace stored as JSON array of timestamped strings
  audit_trace           TEXT DEFAULT '[]',
  -- webhook origin link (for traceability)
  webhook_event_id      TEXT DEFAULT '',   -- links to webhook_audit_log.id
  created_at            TEXT NOT NULL      -- ISO timestamp of queue acceptance
);

-- Index for fast status queries
CREATE INDEX IF NOT EXISTS idx_queue_status
  ON queue_audit_items(current_status);

CREATE INDEX IF NOT EXISTS idx_queue_origin
  ON queue_audit_items(origin);

CREATE INDEX IF NOT EXISTS idx_queue_received_at
  ON queue_audit_items(received_at DESC);
