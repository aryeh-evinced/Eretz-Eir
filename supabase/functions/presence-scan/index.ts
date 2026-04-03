// supabase/functions/presence-scan/index.ts
// Detects disconnected players, handles host transfer, and zeroes
// answers for players absent > 5 minutes. Runs every 60 seconds via pg_cron.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const JOB_NAME = 'presence-scan'

/** Seconds of no heartbeat before a player is considered disconnected. */
const DISCONNECT_THRESHOLD_SECONDS = 60

/** Seconds of no heartbeat before zeroing a player's unsubmitted answers. */
const ABANDON_THRESHOLD_SECONDS = 300

interface DisconnectedPlayer {
  game_id: string
  player_id: string
  last_seen_at: string
}

interface ActiveGame {
  id: string
  created_by: string
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
    const now = Date.now()
    const disconnectCutoff = new Date(now - DISCONNECT_THRESHOLD_SECONDS * 1000).toISOString()
    const abandonCutoff = new Date(now - ABANDON_THRESHOLD_SECONDS * 1000).toISOString()

    // 1. Get all active (playing) games
    const { data: activeGames, error: gamesError } = await supabase
      .from('game_sessions')
      .select('id, created_by')
      .eq('status', 'playing')

    if (gamesError) throw gamesError
    if (!activeGames || activeGames.length === 0) {
      await updateHeartbeat(supabase, 0, 0, 0)
      const duration_ms = Date.now() - start
      return new Response(JSON.stringify({ job: JOB_NAME, status: 'ok', disconnected: 0, host_transfers: 0, abandoned: 0, duration_ms }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const activeGameIds = activeGames.map((g: ActiveGame) => g.id)
    const hostByGame = new Map<string, string>()
    for (const g of activeGames as ActiveGame[]) {
      hostByGame.set(g.id, g.created_by)
    }

    // 2. Find disconnected players (last_seen_at < 60 seconds ago) in active games
    const { data: disconnected, error: dcError } = await supabase
      .from('game_players')
      .select('game_id, player_id, last_seen_at')
      .in('game_id', activeGameIds)
      .lt('last_seen_at', disconnectCutoff)

    if (dcError) throw dcError

    let hostTransfers = 0
    let abandonedCount = 0
    const disconnectedCount = disconnected?.length ?? 0

    if (disconnected && disconnected.length > 0) {
      // Group by game for efficient processing
      const byGame = new Map<string, DisconnectedPlayer[]>()
      for (const p of disconnected as DisconnectedPlayer[]) {
        const list = byGame.get(p.game_id) ?? []
        list.push(p)
        byGame.set(p.game_id, list)
      }

      for (const [gameId, players] of byGame) {
        const currentHost = hostByGame.get(gameId)

        // 3. Host transfer: if the host is among disconnected, transfer to next active player
        const hostDisconnected = players.some((p) => p.player_id === currentHost)
        if (hostDisconnected && currentHost) {
          const newHost = await transferHostInGame(supabase, gameId, currentHost)
          if (newHost) {
            hostTransfers++
            console.log(JSON.stringify({
              job: JOB_NAME,
              action: 'host_transferred',
              game_id: gameId,
              from: currentHost,
              to: newHost,
            }))
          } else {
            console.log(JSON.stringify({
              job: JOB_NAME,
              action: 'host_transfer_no_candidate',
              game_id: gameId,
              current_host: currentHost,
            }))
          }
        }

        // 4. Abandoned players (> 5 minutes): zero their unsubmitted answers
        for (const player of players) {
          const lastSeenMs = new Date(player.last_seen_at).getTime()
          const abandonCutoffMs = new Date(abandonCutoff).getTime()

          if (lastSeenMs < abandonCutoffMs) {
            // Find active rounds for this game
            const { data: activeRounds } = await supabase
              .from('rounds')
              .select('id')
              .eq('game_id', gameId)
              .eq('status', 'playing')

            if (activeRounds && activeRounds.length > 0) {
              const roundIds = activeRounds.map((r: { id: string }) => r.id)

              const { error: zeroError, count } = await supabase
                .from('answers')
                .update({
                  score: 0,
                  is_valid: false,
                  ai_explanation: 'Player disconnected — answer forfeited',
                })
                .eq('player_id', player.player_id)
                .in('round_id', roundIds)
                .is('submitted_at', null)

              if (zeroError) {
                console.error(JSON.stringify({
                  job: JOB_NAME,
                  action: 'abandon_zero_failed',
                  player_id: player.player_id,
                  game_id: gameId,
                  error: zeroError.message,
                }))
              } else if (count && count > 0) {
                abandonedCount++
                console.log(JSON.stringify({
                  job: JOB_NAME,
                  action: 'player_answers_zeroed',
                  player_id: player.player_id,
                  game_id: gameId,
                  zeroed_answers: count,
                }))
              }
            }
          }
        }
      }
    }

    await updateHeartbeat(supabase, disconnectedCount, hostTransfers, abandonedCount)

    const duration_ms = Date.now() - start
    console.log(JSON.stringify({
      job: JOB_NAME,
      status: 'ok',
      disconnected: disconnectedCount,
      host_transfers: hostTransfers,
      abandoned: abandonedCount,
      duration_ms,
    }))

    return new Response(JSON.stringify({
      job: JOB_NAME,
      status: 'ok',
      disconnected: disconnectedCount,
      host_transfers: hostTransfers,
      abandoned: abandonedCount,
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

/**
 * Transfer host to the next eligible (recently seen) player.
 * Returns the new host's player_id, or null if no candidate found.
 */
// deno-lint-ignore no-explicit-any
async function transferHostInGame(supabase: any, gameId: string, currentHostId: string): Promise<string | null> {
  const cutoff = new Date(Date.now() - DISCONNECT_THRESHOLD_SECONDS * 1000).toISOString()

  const { data: candidates } = await supabase
    .from('game_players')
    .select('player_id')
    .eq('game_id', gameId)
    .neq('player_id', currentHostId)
    .gte('last_seen_at', cutoff)
    .order('joined_at', { ascending: true })
    .limit(1)

  if (!candidates || candidates.length === 0) return null

  const newHostId = candidates[0].player_id

  const { error } = await supabase
    .from('game_sessions')
    .update({ created_by: newHostId })
    .eq('id', gameId)

  if (error) {
    console.error(JSON.stringify({
      job: JOB_NAME,
      action: 'host_transfer_db_failed',
      game_id: gameId,
      new_host: newHostId,
      error: error.message,
    }))
    return null
  }

  return newHostId
}

// deno-lint-ignore no-explicit-any
async function updateHeartbeat(supabase: any, disconnected: number, transfers: number, abandoned: number) {
  const { error } = await supabase
    .from('job_health')
    .update({
      last_success_at: new Date().toISOString(),
      run_count: disconnected,
    })
    .eq('job_name', JOB_NAME)

  if (error) {
    console.error(JSON.stringify({
      job: JOB_NAME,
      action: 'heartbeat_failed',
      error: error.message,
      stats: { disconnected, transfers, abandoned },
    }))
  }
}
