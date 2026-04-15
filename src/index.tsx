// ============================================================
// LANE-ECO BUDGET CONTROL SYSTEM — Main Entry Point
// HUB-20: Persistent Sovereign Intake Storage + Boot Restore
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
}

const app = new Hono<{ Bindings: Bindings }>()

// ─── STATIC ─────────────────────────────────────────────────
app.use('/static/*', serveStatic({ root: './public' }))

// ─── BOOT INIT MIDDLEWARE ────────────────────────────────────
// On every first request, initialize D1 adapter and attempt boot restore.
// Uses a lightweight singleton flag to avoid re-running per request.

app.use('*', async (c, next) => {
  // Inject SOVEREIGN_DB into the sovereign module on first request
  // The initSovereignDB call is idempotent — only runs full restore once.
  if (c.env?.SOVEREIGN_DB) {
    await initSovereignDB(c.env.SOVEREIGN_DB)
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
      version: '1.3.1',
      build_session: 'hub21',
      persistence: bootStatus.storage_mode,
      repo_target: 'https://github.com/ganihypha/Lane-eco-budget-control-system.git'
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
