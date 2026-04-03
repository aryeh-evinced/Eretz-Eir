// supabase/functions/room-cleanup/index.ts
// Cleans up abandoned rooms: stale lobbies and ghost games.
// Runs every 15 minutes via pg_cron.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const JOB_NAME = 'room-cleanup'

/** Waiting rooms older than this (seconds) are considered abandoned. */
const LOBBY_STALE_SECONDS = 3600 // 1 hour

/** If ALL players in a playing game are gone this long, the game is a ghost. */
const GHOST_GAME_SECONDS = 600 // 10 minutes

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
    let lobbiesCleaned = 0
    let ghostsCleaned = 0

    // -----------------------------------------------------------------------
    // 1. Abandoned lobbies: rooms in 'waiting' created > 1 hour ago
    // -----------------------------------------------------------------------
    const lobbyCutoff = new Date(Date.now() - LOBBY_STALE_SECONDS * 1000).toISOString()

    const { data: staleLobbies, error: lobbyFetchError } = await supabase
      .from('rooms')
      .select('id')
      .eq('status', 'waiting')
      .lt('created_at', lobbyCutoff)

    if (lobbyFetchError) throw lobbyFetchError

    if (staleLobbies && staleLobbies.length > 0) {
      const staleLobbyIds = staleLobbies.map((r: { id: string }) => r.id)

      // Mark rooms as finished
      const { error: roomUpdateError } = await supabase
        .from('rooms')
        .update({ status: 'finished' })
        .in('id', staleLobbyIds)
        .eq('status', 'waiting')

      if (roomUpdateError) throw roomUpdateError

      // Mark associated game_sessions as finished
      const { error: sessionUpdateError } = await supabase
        .from('game_sessions')
        .update({ status: 'finished', finished_at: new Date().toISOString() })
        .in('room_id', staleLobbyIds)
        .neq('status', 'finished')

      if (sessionUpdateError) {
        console.error(JSON.stringify({
          job: JOB_NAME,
          action: 'lobby_session_cleanup_failed',
          error: sessionUpdateError.message,
        }))
      }

      lobbiesCleaned = staleLobbyIds.length
      console.log(JSON.stringify({
        job: JOB_NAME,
        action: 'lobbies_cleaned',
        count: lobbiesCleaned,
        room_ids: staleLobbyIds,
      }))
    }

    // -----------------------------------------------------------------------
    // 2. Ghost games: rooms in 'playing' where ALL players are gone > 10 min
    // -----------------------------------------------------------------------
    const ghostCutoff = new Date(Date.now() - GHOST_GAME_SECONDS * 1000).toISOString()

    // Get rooms currently in 'playing' status
    const { data: playingRooms, error: playingFetchError } = await supabase
      .from('rooms')
      .select('id')
      .eq('status', 'playing')

    if (playingFetchError) throw playingFetchError

    if (playingRooms && playingRooms.length > 0) {
      const playingRoomIds = playingRooms.map((r: { id: string }) => r.id)

      // Get game_sessions for these rooms
      const { data: playingSessions, error: sessionFetchError } = await supabase
        .from('game_sessions')
        .select('id, room_id')
        .in('room_id', playingRoomIds)
        .eq('status', 'playing')

      if (sessionFetchError) throw sessionFetchError

      const ghostRoomIds: string[] = []
      const ghostSessionIds: string[] = []

      if (playingSessions && playingSessions.length > 0) {
        for (const session of playingSessions as { id: string; room_id: string }[]) {
          // Check if ANY player has been seen recently
          const { data: recentPlayers } = await supabase
            .from('game_players')
            .select('player_id')
            .eq('game_id', session.id)
            .gte('last_seen_at', ghostCutoff)
            .limit(1)

          if (!recentPlayers || recentPlayers.length === 0) {
            // All players are ghosts
            ghostRoomIds.push(session.room_id)
            ghostSessionIds.push(session.id)
          }
        }
      }

      if (ghostRoomIds.length > 0) {
        // Mark ghost rooms as finished
        const { error: ghostRoomError } = await supabase
          .from('rooms')
          .update({ status: 'finished' })
          .in('id', ghostRoomIds)

        if (ghostRoomError) {
          console.error(JSON.stringify({
            job: JOB_NAME,
            action: 'ghost_room_cleanup_failed',
            error: ghostRoomError.message,
          }))
        }

        // Mark ghost sessions as finished
        const { error: ghostSessionError } = await supabase
          .from('game_sessions')
          .update({ status: 'finished', finished_at: new Date().toISOString() })
          .in('id', ghostSessionIds)

        if (ghostSessionError) {
          console.error(JSON.stringify({
            job: JOB_NAME,
            action: 'ghost_session_cleanup_failed',
            error: ghostSessionError.message,
          }))
        }

        // Also complete any playing rounds in ghost games
        const { error: roundError } = await supabase
          .from('rounds')
          .update({ status: 'completed', ended_at: new Date().toISOString(), ended_by: 'timer' })
          .in('game_id', ghostSessionIds)
          .eq('status', 'playing')

        if (roundError) {
          console.error(JSON.stringify({
            job: JOB_NAME,
            action: 'ghost_round_cleanup_failed',
            error: roundError.message,
          }))
        }

        ghostsCleaned = ghostRoomIds.length
        console.log(JSON.stringify({
          job: JOB_NAME,
          action: 'ghosts_cleaned',
          count: ghostsCleaned,
          room_ids: ghostRoomIds,
          session_ids: ghostSessionIds,
        }))
      }
    }

    // Update heartbeat
    const totalCleaned = lobbiesCleaned + ghostsCleaned
    const { error: heartbeatError } = await supabase
      .from('job_health')
      .update({
        last_success_at: new Date().toISOString(),
        run_count: totalCleaned,
      })
      .eq('job_name', JOB_NAME)

    if (heartbeatError) {
      console.error(JSON.stringify({
        job: JOB_NAME,
        action: 'heartbeat_failed',
        error: heartbeatError.message,
      }))
    }

    const duration_ms = Date.now() - start
    console.log(JSON.stringify({
      job: JOB_NAME,
      status: 'ok',
      lobbies_cleaned: lobbiesCleaned,
      ghosts_cleaned: ghostsCleaned,
      total_cleaned: totalCleaned,
      duration_ms,
    }))

    return new Response(JSON.stringify({
      job: JOB_NAME,
      status: 'ok',
      lobbies_cleaned: lobbiesCleaned,
      ghosts_cleaned: ghostsCleaned,
      total_cleaned: totalCleaned,
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
