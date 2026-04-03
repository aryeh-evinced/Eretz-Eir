// supabase/functions/stats-refresh/index.ts
// Phase 6: Real stats refresh pipeline.
// Drains stats_refresh_queue via drain_stats_queue RPC, recomputes
// player_stats, and refreshes the player_category_stats materialized view.
// Runs every minute via pg_cron.
//
// Freshness SLO: player stats stale for at most 2 minutes.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const JOB_NAME = 'stats-refresh'
const BATCH_SIZE = 100

Deno.serve(async (req: Request): Promise<Response> => {
  const start = Date.now()

  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    // Check queue depth first for observability
    const { count: queueDepth } = await supabase
      .from('stats_refresh_queue')
      .select('*', { count: 'exact', head: true })

    console.log(JSON.stringify({
      job: JOB_NAME,
      status: 'starting',
      queue_depth: queueDepth ?? 0,
    }))

    if (queueDepth === 0) {
      // Nothing to process — update heartbeat and return
      await supabase
        .from('job_health')
        .update({
          last_success_at: new Date().toISOString(),
          run_count: supabase.rpc ? undefined : 1,
        })
        .eq('job_name', JOB_NAME)

      const duration_ms = Date.now() - start
      console.log(JSON.stringify({ job: JOB_NAME, status: 'ok', message: 'queue empty', duration_ms }))

      return new Response(JSON.stringify({ job: JOB_NAME, status: 'ok', refreshed: 0, duration_ms }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Drain the queue via the server-side RPC (includes advisory lock)
    const { data: refreshed, error: rpcError } = await supabase.rpc('drain_stats_queue', {
      p_batch_size: BATCH_SIZE,
    })

    if (rpcError) {
      throw new Error(`drain_stats_queue RPC failed: ${rpcError.message}`)
    }

    const refreshedCount = refreshed as number

    if (refreshedCount === -1) {
      // Lock contention — another refresh is in progress; skip
      const duration_ms = Date.now() - start
      console.log(JSON.stringify({
        job: JOB_NAME,
        status: 'skipped',
        reason: 'advisory_lock_contention',
        duration_ms,
      }))

      return new Response(JSON.stringify({
        job: JOB_NAME,
        status: 'skipped',
        reason: 'advisory_lock_contention',
        duration_ms,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Update job health heartbeat
    // Use raw SQL via RPC to atomically increment run_count
    const { error: healthError } = await supabase
      .from('job_health')
      .update({
        last_success_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('job_name', JOB_NAME)

    if (healthError) {
      console.warn(JSON.stringify({
        job: JOB_NAME,
        warning: 'failed to update job_health',
        error: healthError.message,
      }))
    }

    const duration_ms = Date.now() - start
    console.log(JSON.stringify({
      job: JOB_NAME,
      status: 'ok',
      refreshed: refreshedCount,
      queue_depth_before: queueDepth,
      duration_ms,
    }))

    return new Response(JSON.stringify({
      job: JOB_NAME,
      status: 'ok',
      refreshed: refreshedCount,
      duration_ms,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const duration_ms = Date.now() - start
    const error = err instanceof Error ? err.message : String(err)

    console.error(JSON.stringify({ job: JOB_NAME, status: 'error', error, duration_ms }))

    await supabase
      .from('job_health')
      .update({ last_error: error })
      .eq('job_name', JOB_NAME)
      .catch(() => undefined)

    return new Response(JSON.stringify({ job: JOB_NAME, status: 'error', error, duration_ms }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
