module.exports = {
  apps: [
    {
      name: 'interview-quiz-app-backend',
      script: 'npm',
      args: 'start',
      cwd: '/opt/interview-quiz-app/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3010
      },
      // Smart restart logic
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 5,
      min_uptime: '10s',
      
      // Logging
      log_file: '/var/log/interview-quiz-app/combined-3.log',
      out_file: '/var/log/interview-quiz-app/backend-out-3.log',
      error_file: '/var/log/interview-quiz-app/backend-error-3.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Health monitoring
      watch: true,
      ignore_watch: ['node_modules', 'tmp'],
      
      // Advanced features
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Environment-specific settings
      env_production: {
        NODE_ENV: 'production',
        PORT: 3010
      }
    },
    {
      name: 'interview-quiz-app-frontend',
      script: 'npm',
      args: 'run preview',
      cwd: '/opt/interview-quiz-app',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 4173
      },
      max_memory_restart: '512M',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Logging
      log_file: '/var/log/interview-quiz-app/frontend-combined-1.log',
      out_file: '/var/log/interview-quiz-app/frontend-out-1.log',
      error_file: '/var/log/interview-quiz-app/frontend-error-1.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Health monitoring
      watch: true,
      ignore_watch: ['node_modules', 'tmp', 'dist'],
      
      // Advanced features
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Environment-specific settings
      env_production: {
        NODE_ENV: 'production',
        PORT: 4173
      }
    }
  ]
};
