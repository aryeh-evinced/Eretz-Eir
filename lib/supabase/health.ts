import { createAdminClient } from './admin'

export interface JobHealth {
  job_name: string
  last_success_at: string
  last_error: string | null
  run_count: number
}

export interface HealthStatus {
  ok: boolean
  timestamp: string
  components: {
    supabase: 'ok' | 'error'
    jobs: Record<string, 'ok' | 'stale' | 'never_run'>
  }
  multiplayer_ready: boolean
}

/** Jobs are considered stale if they haven't run within this window */
const STALE_THRESHOLD_MS: Record<string, number> = {
  'room-cleanup':      20 * 60 * 1000,  // 20 min (runs every 15)
  'round-backstop':     3 * 60 * 1000,  // 3 min  (runs every 1)
  'presence-scan':      3 * 60 * 1000,  // 3 min
  'stats-refresh':      3 * 60 * 1000,  // 3 min
  'retention-cleanup': 35 * 24 * 60 * 60 * 1000, // 35 days (runs monthly)
}

export async function checkHealth(): Promise<HealthStatus> {
  const timestamp = new Date().toISOString()

  let supabaseStatus: 'ok' | 'error' = 'error'
  const jobStatuses: Record<string, 'ok' | 'stale' | 'never_run'> = {}

  try {
    const admin = createAdminClient()

    // Connectivity probe: read job_health rows
    const { data, error } = await admin
      .from('job_health')
      .select('job_name, last_success_at, last_error, run_count')
      .order('job_name')

    if (error) throw error

    supabaseStatus = 'ok'

    const now = Date.now()
    for (const row of (data as JobHealth[])) {
      const threshold = STALE_THRESHOLD_MS[row.job_name] ?? 10 * 60 * 1000
      const lastRun = new Date(row.last_success_at).getTime()
      const age = now - lastRun

      if (row.run_count === 0) {
        jobStatuses[row.job_name] = 'never_run'
      } else if (age > threshold) {
        jobStatuses[row.job_name] = 'stale'
      } else {
        jobStatuses[row.job_name] = 'ok'
      }
    }
  } catch {
    supabaseStatus = 'error'
  }

  const allJobsOk = Object.values(jobStatuses).every((s) => s === 'ok' || s === 'never_run')
  const multiplayerReady = supabaseStatus === 'ok'

  return {
    ok: supabaseStatus === 'ok',
    timestamp,
    components: {
      supabase: supabaseStatus,
      jobs: jobStatuses,
    },
    multiplayer_ready: multiplayerReady && allJobsOk,
  }
}
