// ============================================================
// UI HELPERS — Lane-Eco Budget Control System
// Shell, badges, status labels, color system
// ============================================================

export function shellHtml(opts: {
  title: string
  activeNav: string
  body: string
  extraHead?: string
}): string {
  const navItems = [
    { href: '/', label: 'Dashboard', icon: 'fa-gauge-high', key: 'dashboard' },
    { href: '/sessions', label: 'Sessions', icon: 'fa-list-check', key: 'sessions' },
    { href: '/lanes', label: 'Lanes', icon: 'fa-road', key: 'lanes' },
    { href: '/ecosystem', label: 'Ecosystem', icon: 'fa-globe', key: 'ecosystem' },
    { href: '/decisions', label: 'Decision Log', icon: 'fa-book-open', key: 'decisions' },
  ]

  const navHtml = navItems.map(item => {
    const isActive = opts.activeNav === item.key
    const cls = isActive
      ? 'flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 text-white font-semibold text-sm'
      : 'flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm transition-colors'
    return `<a href="${item.href}" class="${cls}"><i class="fas ${item.icon} w-4 text-center"></i>${item.label}</a>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${opts.title} — Budget Controller</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet"/>
  ${opts.extraHead || ''}
  <style>
    body { background: #0f172a; color: #e2e8f0; font-family: 'Inter', system-ui, sans-serif; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; }
    .badge-safe { background: #14532d; color: #86efac; border: 1px solid #166534; }
    .badge-warning { background: #78350f; color: #fcd34d; border: 1px solid #92400e; }
    .badge-exceeded { background: #7f1d1d; color: #fca5a5; border: 1px solid #991b1b; }
    .badge-healthy { background: #14532d; color: #86efac; border: 1px solid #166534; }
    .badge-watch { background: #78350f; color: #fcd34d; border: 1px solid #92400e; }
    .badge-overloaded { background: #7f1d1d; color: #fca5a5; border: 1px solid #991b1b; }
    .badge-frozen { background: #1e3a5f; color: #93c5fd; border: 1px solid #1d4ed8; }
    .signal-GO { background: #14532d; color: #86efac; font-weight: 700; }
    .signal-WATCH { background: #78350f; color: #fcd34d; font-weight: 700; }
    .signal-STOP { background: #7f1d1d; color: #fca5a5; font-weight: 700; }
    .burn-bar { background: #334155; border-radius: 99px; overflow: hidden; height: 6px; }
    .burn-fill-safe { background: #22c55e; height: 100%; border-radius: 99px; transition: width 0.3s; }
    .burn-fill-warning { background: #f59e0b; height: 100%; border-radius: 99px; transition: width 0.3s; }
    .burn-fill-exceeded { background: #ef4444; height: 100%; border-radius: 99px; transition: width 0.3s; }
    input, select, textarea { background: #0f172a; border: 1px solid #475569; color: #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; width: 100%; }
    input:focus, select:focus, textarea:focus { outline: none; border-color: #3b82f6; }
    .btn-primary { background: #2563eb; color: white; padding: 0.5rem 1.25rem; border-radius: 0.5rem; font-weight: 600; font-size: 0.875rem; cursor: pointer; border: none; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-secondary { background: #334155; color: #e2e8f0; padding: 0.5rem 1.25rem; border-radius: 0.5rem; font-weight: 600; font-size: 0.875rem; cursor: pointer; border: none; }
    .btn-secondary:hover { background: #475569; }
    .btn-danger { background: #991b1b; color: white; padding: 0.5rem 1.25rem; border-radius: 0.5rem; font-weight: 600; font-size: 0.875rem; cursor: pointer; border: none; }
    .btn-danger:hover { background: #7f1d1d; }
    .btn-warn { background: #92400e; color: #fcd34d; padding: 0.5rem 1.25rem; border-radius: 0.5rem; font-weight: 600; font-size: 0.875rem; cursor: pointer; border: none; }
    .btn-warn:hover { background: #78350f; }
    .form-label { font-size: 0.75rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; display: block; }
    .stat-card { padding: 1.25rem; }
    .stat-val { font-size: 2rem; font-weight: 700; line-height: 1; }
    .stat-lbl { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.25rem; }
    .table-row { border-bottom: 1px solid #1e293b; }
    .table-row:last-child { border-bottom: none; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 1rem; }
    .modal-box { background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; }
    .scrollbar-thin { scrollbar-width: thin; scrollbar-color: #334155 transparent; }
    .action-banner { border-left: 4px solid; padding: 0.75rem 1rem; border-radius: 0 0.5rem 0.5rem 0; }
    .action-high { border-color: #ef4444; background: rgba(127,29,29,0.3); }
    .action-medium { border-color: #f59e0b; background: rgba(120,53,15,0.3); }
    .action-low { border-color: #3b82f6; background: rgba(30,58,138,0.2); }
  </style>
</head>
<body class="min-h-screen">
  <div class="flex min-h-screen">
    <!-- Sidebar -->
    <aside class="w-56 flex-shrink-0 border-r border-slate-800" style="background:#1a2332;">
      <div class="p-4 border-b border-slate-800">
        <div class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Internal Tool</div>
        <h1 class="text-white font-bold text-base leading-tight">Budget<br/>Controller</h1>
      </div>
      <nav class="p-3 flex flex-col gap-1">
        ${navHtml}
      </nav>
      <div class="absolute bottom-0 left-0 w-56 p-3 border-t border-slate-800" style="background:#1a2332;">
        <div class="text-xs text-slate-600">Lane-Eco v1.0</div>
      </div>
    </aside>

    <!-- Main -->
    <main class="flex-1 min-h-screen overflow-y-auto scrollbar-thin">
      ${opts.body}
    </main>
  </div>
</body>
</html>`
}

// ─── BADGES ─────────────────────────────────────────────────

export function healthBadge(h: string): string {
  const labels: Record<string, string> = { healthy: 'Healthy', watch: 'Watch', overloaded: 'Overloaded', frozen: 'Frozen', constrained: 'Constrained' }
  return `<span class="badge-${h} text-xs font-semibold px-2 py-0.5 rounded" style="border-radius:4px">${labels[h] || h}</span>`
}

export function statusBadge(s: string): string {
  const colors: Record<string, string> = {
    planned: 'background:#1e3a5f;color:#93c5fd;border:1px solid #1d4ed8',
    active: 'background:#14532d;color:#86efac;border:1px solid #166534',
    partial: 'background:#78350f;color:#fcd34d;border:1px solid #92400e',
    blocked: 'background:#7f1d1d;color:#fca5a5;border:1px solid #991b1b',
    done: 'background:#1f2937;color:#9ca3af;border:1px solid #374151',
    frozen: 'background:#1e3a5f;color:#93c5fd;border:1px solid #1d4ed8',
    cancelled: 'background:#1f2937;color:#6b7280;border:1px solid #374151',
    maintenance: 'background:#4a1d96;color:#c4b5fd;border:1px solid #5b21b6',
    closed: 'background:#1f2937;color:#6b7280;border:1px solid #374151',
  }
  const style = colors[s] || 'background:#1f2937;color:#9ca3af'
  return `<span style="${style};font-size:0.7rem;font-weight:600;padding:2px 8px;border-radius:4px;text-transform:capitalize">${s}</span>`
}

export function signalBadge(signal: string): string {
  return `<span class="signal-${signal} text-xs px-2 py-0.5 rounded" style="border-radius:4px">${signal}</span>`
}

export function blockerBadge(b: string): string {
  if (b === 'none') return `<span style="color:#64748b;font-size:0.7rem">—</span>`
  const colors: Record<string, string> = {
    credential: '#f87171',
    external_access: '#fb923c',
    technical: '#fbbf24',
    strategic: '#a78bfa',
    dependency: '#60a5fa',
    unknown: '#94a3b8'
  }
  return `<span style="color:${colors[b] || '#94a3b8'};font-size:0.7rem;font-weight:600;text-transform:capitalize">${b.replace('_', ' ')}</span>`
}

export function burnBar(pct: number, capStatus: string): string {
  const fillClass = capStatus === 'exceeded' ? 'burn-fill-exceeded' : capStatus === 'warning' ? 'burn-fill-warning' : 'burn-fill-safe'
  const width = Math.min(pct, 100)
  return `<div class="burn-bar"><div class="${fillClass}" style="width:${width}%"></div></div>`
}

export function decisionBadge(d: string): string {
  const colors: Record<string, string> = {
    go: '#14532d:color:#86efac',
    stop: '#7f1d1d:color:#fca5a5',
    freeze: '#1e3a5f:color:#93c5fd',
    split: '#78350f:color:#fcd34d',
    continue: '#14532d:color:#86efac',
    escalate: '#7f1d1d:color:#fca5a5',
    defer: '#1f2937:color:#9ca3af',
    close: '#1f2937:color:#6b7280'
  }
  const [bg, fg] = (colors[d] || '#1f2937:color:#9ca3af').split(':color:')
  return `<span style="background:${bg};color:${fg};font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:uppercase">${d}</span>`
}

export function intensityDots(level: number): string {
  return Array.from({ length: 5 }, (_, i) =>
    `<span style="color:${i < level ? '#f59e0b' : '#334155'}">●</span>`
  ).join('')
}
