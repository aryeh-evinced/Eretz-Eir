/**
 * Golden signals and alert threshold definitions.
 *
 * These are reference values used by monitoring dashboards and the deploy
 * pipeline's canary validation. Actual alerting is handled by the hosting
 * platform (Vercel analytics / external monitoring).
 */

export interface AlertThreshold {
  metric: string;
  source: string;
  threshold: string;
  severity: "critical" | "warning";
  runbook: string;
  pagerTarget: "on-call" | "team-channel" | "none";
}

export const GOLDEN_SIGNALS: AlertThreshold[] = [
  // ─── Latency ───
  {
    metric: "game_route_p95_latency_ms",
    source: "Vercel analytics / edge logs",
    threshold: "< 500ms",
    severity: "critical",
    runbook: "docs/runbooks/deploy.md",
    pagerTarget: "on-call",
  },
  {
    metric: "ai_validation_round_trip_ms",
    source: "ai:call structured logs",
    threshold: "< 5000ms (including fallback)",
    severity: "warning",
    runbook: "docs/runbooks/ai-circuit-breaker-reset.md",
    pagerTarget: "team-channel",
  },

  // ─── Error rate ───
  {
    metric: "route_5xx_rate",
    source: "Vercel analytics / edge logs",
    threshold: "< 1% per route",
    severity: "critical",
    runbook: "docs/runbooks/deploy.md",
    pagerTarget: "on-call",
  },

  // ─── AI health ───
  {
    metric: "ai_fallback_rate",
    source: "ai:call structured logs (fallback=true)",
    threshold: "< 10% sustained (alert), < 20% (canary gate)",
    severity: "warning",
    runbook: "docs/runbooks/ai-circuit-breaker-reset.md",
    pagerTarget: "team-channel",
  },
  {
    metric: "manual_review_entry_rate",
    source: "manual_review log events",
    threshold: "< 20% of rounds",
    severity: "warning",
    runbook: "docs/runbooks/manual-review-queue-drain.md",
    pagerTarget: "team-channel",
  },

  // ─── Game health ───
  {
    metric: "round_backstop_fire_rate",
    source: "round-backstop Edge Function logs",
    threshold: "< baseline + 2 sigma",
    severity: "warning",
    runbook: "docs/runbooks/stuck-round-recovery.md",
    pagerTarget: "team-channel",
  },
  {
    metric: "rate_limit_reject_rate",
    source: "rate_limit log events",
    threshold: "dashboard-visible (no auto-alert)",
    severity: "warning",
    runbook: "docs/runbooks/deploy.md",
    pagerTarget: "none",
  },

  // ─── Operational health ───
  {
    metric: "job_health_staleness",
    source: "job_health table (last_success_at)",
    threshold: "< 2x cron cadence per job",
    severity: "critical",
    runbook: "docs/runbooks/stats-refresh-queue-backlog.md",
    pagerTarget: "on-call",
  },

  // ─── AI budget ───
  {
    metric: "ai_budget_consumption_pct",
    source: "ai:budget_alert log events",
    threshold: "alert at 80%, critical at 95%",
    severity: "critical",
    runbook: "docs/runbooks/ai-circuit-breaker-reset.md",
    pagerTarget: "on-call",
  },

  // ─── Capacity ───
  {
    metric: "concurrent_game_sessions",
    source: "game_sessions table (status=active count)",
    threshold: "< 50 (v1 target)",
    severity: "warning",
    runbook: "docs/runbooks/capacity.md",
    pagerTarget: "team-channel",
  },
];

/**
 * Log retention policy. Aligns with ADR 0002 (children's data compliance).
 */
export const LOG_RETENTION = {
  debug: { days: 30, description: "Debug-level structured logs" },
  info: { days: 30, description: "Info-level structured logs" },
  warn: { days: 90, description: "Warning events" },
  error: { days: 90, description: "Error and security events" },
} as const;
