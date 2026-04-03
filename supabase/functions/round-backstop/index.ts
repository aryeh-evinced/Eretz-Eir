// supabase/functions/round-backstop/index.ts
// Force-ends rounds stuck in 'playing' past their timer.
// Runs every 60 seconds via pg_cron.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const JOB_NAME = 'round-backstop'

/** Grace period in seconds after timer expires before force-ending. */
const GRACE_SECONDS = 30

interface StuckRound {
  id: string
  game_id: string
  round_number: number
  started_at: string
  categories: string[]
}

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
    // Find rounds stuck in 'playing' past their timer + grace period.
    // We join game_sessions to get timer_seconds, then filter where
    // started_at + timer_seconds + grace < now().
    const now = new Date().toISOString()

    // Supabase PostgREST can't do cross-table arithmetic in filters easily,
    // so we use an RPC or raw query. Since we have service role, use .rpc()
    // or fetch all playing rounds and filter in code.
    const { data: playingRounds, error: fetchError } = await supabase
      .from('rounds')
      .select('id, game_id, round_number, started_at, categories')
      .eq('status', 'playing')

    if (fetchError) throw fetchError

    if (!playingRounds || playingRounds.length === 0) {
      await updateHeartbeat(supabase, 0)
      const duration_ms = Date.now() - start
      console.log(JSON.stringify({ job: JOB_NAME, status: 'ok', processed: 0, duration_ms }))
      return new Response(JSON.stringify({ job: JOB_NAME, status: 'ok', processed: 0, duration_ms }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get timer_seconds for each game
    const gameIds = [...new Set(playingRounds.map((r: StuckRound) => r.game_id))]
    const { data: games, error: gamesError } = await supabase
      .from('game_sessions')
      .select('id, timer_seconds')
      .in('id', gameIds)

    if (gamesError) throw gamesError

    const timerByGame = new Map<string, number>()
    for (const g of games ?? []) {
      timerByGame.set(g.id, g.timer_seconds)
    }

    const nowMs = Date.now()
    const stuckRounds: StuckRound[] = (playingRounds as StuckRound[]).filter((round) => {
      const timerSeconds = timerByGame.get(round.game_id)
      if (!timerSeconds) return false
      const startedMs = new Date(round.started_at).getTime()
      const deadlineMs = startedMs + (timerSeconds + GRACE_SECONDS) * 1000
      return nowMs > deadlineMs
    })

    let processed = 0

    for (const round of stuckRounds) {
      try {
        console.log(JSON.stringify({
          job: JOB_NAME,
          action: 'force_end_round',
          round_id: round.id,
          game_id: round.game_id,
          round_number: round.round_number,
        }))

        // 1. Set unsubmitted answers to score 0
        const { error: answerError } = await supabase
          .from('answers')
          .update({
            score: 0,
            is_valid: false,
            ai_explanation: 'Round force-ended by backstop — answer not submitted in time',
          })
          .eq('round_id', round.id)
          .is('submitted_at', null)

        if (answerError) {
          console.error(JSON.stringify({
            job: JOB_NAME,
            action: 'answer_update_failed',
            round_id: round.id,
            error: answerError.message,
          }))
        }

        // 2. Transition round: playing -> reviewing -> completed
        const { error: reviewError } = await supabase
          .from('rounds')
          .update({ status: 'reviewing' })
          .eq('id', round.id)
          .eq('status', 'playing')

        if (reviewError) {
          console.error(JSON.stringify({
            job: JOB_NAME,
            action: 'review_transition_failed',
            round_id: round.id,
            error: reviewError.message,
          }))
          continue
        }

        const { error: completeError } = await supabase
          .from('rounds')
          .update({
            status: 'completed',
            ended_at: now,
            ended_by: 'timer',
          })
          .eq('id', round.id)
          .eq('status', 'reviewing')

        if (completeError) {
          console.error(JSON.stringify({
            job: JOB_NAME,
            action: 'complete_transition_failed',
            round_id: round.id,
            error: completeError.message,
          }))
          continue
        }

        processed++

        console.log(JSON.stringify({
          job: JOB_NAME,
          action: 'round_force_ended',
          round_id: round.id,
          game_id: round.game_id,
        }))
      } catch (roundErr) {
        const msg = roundErr instanceof Error ? roundErr.message : String(roundErr)
        console.error(JSON.stringify({
          job: JOB_NAME,
          action: 'round_processing_error',
          round_id: round.id,
          error: msg,
        }))
      }
    }

    await updateHeartbeat(supabase, processed)

    const duration_ms = Date.now() - start
    console.log(JSON.stringify({ job: JOB_NAME, status: 'ok', processed, total_stuck: stuckRounds.length, duration_ms }))

    return new Response(JSON.stringify({ job: JOB_NAME, status: 'ok', processed, duration_ms }), {
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

// deno-lint-ignore no-explicit-any
async function updateHeartbeat(supabase: any, processed: number) {
  const { error } = await supabase
    .from('job_health')
    .update({
      last_success_at: new Date().toISOString(),
      run_count: processed,
    })
    .eq('job_name', JOB_NAME)

  if (error) {
    console.error(JSON.stringify({ job: JOB_NAME, action: 'heartbeat_failed', error: error.message }))
  }
}
