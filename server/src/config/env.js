import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// ESM imports run before index.js's body. Resolve the server environment here
// so the API and standalone ingestion scripts behave identically from any cwd.
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
