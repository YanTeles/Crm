import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

// Usado apenas para Realtime e leituras interativas no navegador.
export function createClient() {
  client ??= createBrowserClient<Database>(env.supabaseUrl, env.supabaseKey);
  return client;
}
