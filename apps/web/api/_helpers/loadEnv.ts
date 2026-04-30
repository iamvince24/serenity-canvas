import fs from "node:fs";
import path from "node:path";

// Shared env loading for all serverless functions.
// vercel dev doesn't forward .env.local to serverless functions.
if (!process.env.SUPABASE_URL) {
  const candidates = [
    ".env.local",
    ".env.development",
    "../../.env.local",
    "../../.env.development",
  ];

  for (const relativePath of candidates) {
    const absolutePath = path.resolve(process.cwd(), relativePath);
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
