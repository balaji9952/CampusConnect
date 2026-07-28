module.exports = {
  apps: [
    {
      name: 'campus-connect-api',
      script: './dist/index.js',
      // Load .env automatically. All variables defined there (PORT, CORS_ORIGIN,
      // DATABASE_URL, JWT_SECRET, etc.) are injected into the process environment.
      env_file: '.env',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
        PORT: 3019,
        // CORS_ORIGIN: '' — leave empty in dev to allow all origins
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3019,
        // Set CORS_ORIGIN in .env for production; do NOT hardcode domains here.
        // CORS_ORIGIN: 'https://admin.company.com,https://exec.company.com'
      },
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      time: true
    }
  ]
};

