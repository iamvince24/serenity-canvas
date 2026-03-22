// Shared env loading for all serverless functions.
// vercel dev doesn't forward .env.local to serverless functions.
if (!process.env.SUPABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // In production, env vars are set via Vercel dashboard
  }
}
