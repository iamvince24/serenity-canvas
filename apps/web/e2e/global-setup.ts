import { test as setup } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_FILE = path.join(__dirname, ".auth/user.json");

setup("authenticate via UI login", async ({ page }) => {
  // Verify local Supabase is running
  const healthRes = await fetch("http://127.0.0.1:54321/auth/v1/health").catch(
    () => null,
  );
  if (!healthRes?.ok) {
    throw new Error(
      "Local Supabase is not running. Start it with: pnpm db:start && pnpm db:reset",
    );
  }

  // Sign in through the app UI
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Email").fill("test@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in with Email" }).click();

  // Wait for redirect to dashboard (confirms auth succeeded)
  await page.waitForURL("/dashboard", { timeout: 15_000 });

  // Ensure auth dir exists
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  // Save storage state for other tests
  await page.context().storageState({ path: AUTH_FILE });
});
