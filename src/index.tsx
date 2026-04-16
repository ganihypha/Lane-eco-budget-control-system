// ============================================================
// LANE-ECO BUDGET CONTROL SYSTEM — Main Entry Point
// HUB-23: Durable Webhook/Queue Audit + Boot Consistency Fix
// Internal operational tool: Session/Lane/Ecosystem Budget Control
// Stack: Hono + TypeScript + Cloudflare Pages + D1
// ============================================================

import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import dashboard from './routes/dashboard'
import sessions from './routes/sessions'
import lanes from './routes/lanes'
import ecosystem from './routes/ecosystem'
import decisions from './routes/decisions'
import bridge from './routes/bridge'
import sovereign from './routes/sovereign'
import { initSovereignDB, getSovereignBootStatus } from './lib/sovereign'

// ─── CLOUDFLARE BINDINGS TYPE ────────────────────────────────

type Bindings = {
  SOVEREIGN_DB: D1Database
  // HUB-22: Webhook secret for inbound validation
  // Configure via: npx wrangler pages secret put WEBHOOK_SECRET --project-name lane-eco-budget-control
  WEBHOOK_SECRET?: string
}

const app = new Hono<{ Bindings: Bindings }>()

// ─── STATIC ─────────────────────────────────────────────────
app.use('/static/*', serveStatic({ root: './public' }))

// ─── BOOT INIT MIDDLEWARE ────────────────────────────────────
// HUB-23: Atomic boot initialization — prevents first-hit inconsistency.
// Uses a module-level init promise to ensure all concurrent requests
// on a cold boot wait for the same D1 restore to complete before serving.
//
// Without this: 2 concurrent cold-boot requests could both read
// _bootStatus='D1 not yet initialized' before either finishes initDB().
// With this: all requests await the same shared init promise.

let _globalInitPromise: Promise<void> | null = null

app.use('*', async (c, next) => {
  if (c.env?.SOVEREIGN_DB) {
    // HUB-23: Use shared promise — all concurrent cold-boot requests wait for
    // the same initialization instead of each racing to call initSovereignDB.
    if (!_globalInitPromise) {
      _globalInitPromise = initSovereignDB(c.env.SOVEREIGN_DB)
    }
    await _globalInitPromise
  }
  // HUB-22: Forward WEBHOOK_SECRET to request context
  if (c.env?.WEBHOOK_SECRET) {
    c.set('WEBHOOK_SECRET' as never, c.env.WEBHOOK_SECRET)
  }
  // HUB-23: Forward SOVEREIGN_DB to request context for durable webhook/queue audit
  if (c.env?.SOVEREIGN_DB) {
    c.set('SOVEREIGN_DB' as never, c.env.SOVEREIGN_DB)
  }
  await next()
})

// ─── HEALTH ─────────────────────────────────────────────────
app.get('/health', async (c) => {
  const bootStatus = getSovereignBootStatus()

  return c.json({
    success: true,
    data: {
      service: 'Lane-Eco Budget Control System',
      status: 'operational',
      timestamp: new Date().toISOString(),
      modules: ['dashboard', 'sessions', 'lanes', 'ecosystem', 'decisions', 'prompt_bridge', 'sovereign_intake'],
      prompt_bridge: {
        phase_a: 'export_layer',
        phase_b: 'pack_generator',
        phase_c: 'closeout_ingestor',
        phase_d: 'sovereign_source_intake',
        phase_e: 'truth_maturity_upgrade',
        api_endpoints: [
          '/bridge/api/pack', '/bridge/api/ecosystem', '/bridge/api/repo',
          '/bridge/api/session', '/bridge/api/lane', '/bridge/api/decisions', '/bridge/api/ingest'
        ]
      },
      sovereign_intake: {
        status: 'active',
        storage_mode: bootStatus.storage_mode,
        active_source_restored_on_boot: bootStatus.restored,
        boot_restore_note: bootStatus.note,
        // HUB-21: explicit init_complete flag for boot consistency verification
        // Both /health and /sovereign/api/summary read from same sovereignStore instance
        // so they are always consistent after first request initialization completes.
        init_complete: bootStatus.storage_mode !== 'in-memory' || bootStatus.restored,
        boot_consistency: 'GUARANTEED — /health and /sovereign/api/summary share same sovereignStore instance',
        api_endpoints: [
          '/sovereign/api/ingest', '/sovereign/api/summary', '/sovereign/api/payload',
          '/sovereign/api/sessions', '/sovereign/api/governance', '/sovereign/api/merge', '/sovereign/api/clear',
          '/sovereign/api/webhook/inbound', '/sovereign/api/queue/status'
        ]
      },
      version: '1.5.0',
      build_session: 'hub23',
      persistence: bootStatus.storage_mode,
      repo_target: 'https://github.com/ganihypha/Lane-eco-budget-control-system.git',
      // HUB-22: Webhook secret configuration status (never expose actual secret value)
      webhook_secret_configured: !!(c.env?.WEBHOOK_SECRET)
    }
  })
})

// ─── ROUTES ─────────────────────────────────────────────────
app.route('/', dashboard)
app.route('/sessions', sessions)
app.route('/lanes', lanes)
app.route('/ecosystem', ecosystem)
app.route('/decisions', decisions)
app.route('/bridge', bridge)
app.route('/sovereign', sovereign)

// ─── 404 ────────────────────────────────────────────────────
app.notFound((c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>404 — Budget Controller</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>body { background: #0f172a; color: #e2e8f0; }</style>
    </head>
    <body class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="text-8xl font-bold text-slate-700 mb-4">404</div>
        <h1 class="text-xl font-bold text-white mb-2">Page Not Found</h1>
        <p class="text-slate-500 mb-6">The route you requested doesn't exist.</p>
        <a href="/" class="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700">← Dashboard</a>
      </div>
    </body>
    </html>
  `, 404)
})

export default app
