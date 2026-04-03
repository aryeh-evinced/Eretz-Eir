// supabase/functions/room-cleanup/index.ts
// Phase 2 stub — real implementation in Phase 4.
// Marks finished/abandoned rooms as 'finished' so their codes become reusable.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const JOB_NAME = 'room-cleanup'

Deno.serve(async (req: Request): Promise<Response> => {
  const start = Date.now()

  // Service-to-service auth check
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
    console.log(JSON.stringify({ job: JOB_NAME, status: 'ok', message: 'stub — real implementation in Phase 4' }))

    // Update heartbeat
    const { error } = await supabase
      .from('job_health')
      .update({ last_success_at: new Date().toISOString(), run_count: 1 })
      .eq('job_name', JOB_NAME)

    if (error) throw error

    const duration_ms = Date.now() - start
    console.log(JSON.stringify({ job: JOB_NAME, status: 'ok', duration_ms }))

    return new Response(JSON.stringify({ job: JOB_NAME, status: 'ok', duration_ms }), {
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
