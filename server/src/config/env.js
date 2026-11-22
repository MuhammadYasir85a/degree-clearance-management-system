import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// ESM imports run before index.js's body. Resolve the server environment here
// so the API and standalone ingestion scripts behave identically from any cwd.
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

export function validateEnvironment() {
  const missing = ['DATABASE_URL', 'JWT_SECRET'].filter((name) => !process.env[name]?.trim());
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}.`);
  if (process.env.JWT_SECRET.trim().length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');
  if (process.env.NODE_ENV === 'production' && process.env.DEMO_OTP?.trim()) {
    throw new Error('DEMO_OTP must not be configured in production.');
  }
}
