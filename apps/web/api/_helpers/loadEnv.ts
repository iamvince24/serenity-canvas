import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Shared env loading for all serverless functions.
// vercel dev doesn't forward .env.local to serverless functions.
if (!process.env.SUPABASE_URL) {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const appRoot = path.resolve(dir, "../..");
  const repoRoot = path.resolve(appRoot, "../..");

  const candidates = [
    path.join(appRoot, ".env.local"),
    path.join(appRoot, ".env.development"),
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, ".env.development"),
  ];

  for (const absolutePath of candidates) {
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    try {
      process.loadEnvFile(absolutePath);
      break;
    } catch {
      // In production, env vars are set via Vercel dashboard.
    }
  }
}
