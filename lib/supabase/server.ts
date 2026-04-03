import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Server Supabase client — for use in Server Components and Route Handlers.
 * Uses the anon key; respects RLS. For privileged operations use admin.ts.
 *
 * Always call this function fresh per-request (do not cache the instance
 * across requests, as it carries per-request auth context in Phase 3+).
 */
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
