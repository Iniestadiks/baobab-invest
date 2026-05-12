export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh_secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  app: {
    name: process.env.APP_NAME || 'BAOBAB INVEST',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    apiUrl: process.env.API_URL || 'http://localhost:3001',
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
}
