import { createClient } from "@supabase/supabase-js";
import { createServerClient as ssrCreate } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@serenity/shared/types";

export function createAnonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function createSessionClient() {
  const cookieStore = await cookies();
  return ssrCreate<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (
          xs: {
            name: string;
            value: string;
            options: Record<string, unknown>;
          }[],
        ) =>
          xs.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          ),
      },
    },
  );
}
