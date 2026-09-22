import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  // Server
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',
  supabase: {
    url: process.env.SUPABASE_URL || 'https://twluwkcduduvswmjvqfl.supabase.co',
    anonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bHV3a2NkdWR1dnN3bWp2cWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MDM0OTgsImV4cCI6MjEwMTE3OTQ5OH0.F_P4xTDf0UMH3-HRKNa_GW4YlYz31hBz5KhE2tn4pm0',
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // JWT
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Dedicated High-Security Admin JWT (completely isolated from student tokens)
  adminJwt: {
    secret: process.env.ADMIN_JWT_SECRET || 'studysync-master-admin-secure-vault-key-2026-isolated',
    expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '12h',
  },

  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback',
  },

  // Groq API (single or rotated keys)
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    keys: (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '')
      .replace(/["']/g, '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
  },

  // Gemini API (single or rotated keys)
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    keys: (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '')
      .replace(/["']/g, '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
  },

  // Tavily API
  tavily: {
    apiKey: process.env.TAVILY_API_KEY || '',
  },

  // SendGrid
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'reminders@studysync.ai',
  },

  // WhatsApp Cloud API
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  },

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};
