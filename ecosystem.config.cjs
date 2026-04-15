module.exports = {
  apps: [
    {
      name: 'budget-controller',
      script: 'npx',
      // HUB-22: Added .dev.vars for WEBHOOK_SECRET in local dev
      // .dev.vars file contains: WEBHOOK_SECRET=hub22-local-dev-secret
      // Production secret set via: wrangler pages secret put WEBHOOK_SECRET
      args: 'wrangler pages dev dist --d1=SOVEREIGN_DB:lane-eco-sovereign-store --local --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
