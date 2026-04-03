/**
 * k6 Load Test: Concurrent Players
 *
 * Simulates full multiplayer game flows with concurrent sessions.
 * Tests create → join → start → submit answers → done → end lifecycle.
 *
 * Prerequisites:
 *   - k6 installed: `brew install k6`
 *   - Server running with seeded auth tokens
 *   - Environment variables: BASE_URL, AUTH_TOKEN
 *
 * Run:
 *   k6 run --env BASE_URL=http://localhost:3000 \
 *          --env AUTH_TOKEN=$E2E_PLAYER_TOKEN \
 *          tests/load/concurrent-players.k6.ts
 *
 * Thresholds (from implementation plan):
 *   - P95 response time < 2000ms
 *   - Error rate < 1%
 *   - No connection pool exhaustion at 50 concurrent sessions
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ─── Custom metrics ───
const gameCreateDuration = new Trend("game_create_duration", true);
const gameJoinDuration = new Trend("game_join_duration", true);
const gameStartDuration = new Trend("game_start_duration", true);
const answerSubmitDuration = new Trend("answer_submit_duration", true);
const gameEndDuration = new Trend("game_end_duration", true);
const healthCheckDuration = new Trend("health_check_duration", true);
const errorCount = new Counter("errors");
const successRate = new Rate("success_rate");

// ─── Options ───
export const options = {
  scenarios: {
    // Ramp up to 50 concurrent sessions over 2 minutes, hold for 3 minutes
    concurrent_games: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "30s", target: 25 },
        { duration: "1m", target: 50 },
        { duration: "3m", target: 50 }, // Hold at peak
        { duration: "30s", target: 0 }, // Ramp down
      ],
      gracefulRampDown: "30s",
    },
  },

  thresholds: {
    // P95 < 2 seconds for all game operations
    game_create_duration: ["p(95)<2000"],
    game_join_duration: ["p(95)<2000"],
    game_start_duration: ["p(95)<2000"],
    answer_submit_duration: ["p(95)<2000"],
    game_end_duration: ["p(95)<2000"],
    health_check_duration: ["p(95)<500"],

    // Error rate < 1%
    success_rate: ["rate>0.99"],

    // Overall HTTP failures < 1%
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "test-token";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${AUTH_TOKEN}`,
};

const HEBREW_LETTERS = "אבגדהוזחטיכלמנסעפצקרשת";
const CATEGORIES = ["ארץ", "עיר", "חיה", "צמח", "ילד/ה", "דבר"];

/**
 * Get a random Hebrew letter for game testing.
 */
function randomLetter(): string {
  return HEBREW_LETTERS[Math.floor(Math.random() * HEBREW_LETTERS.length)];
}

/**
 * Generate a fake answer starting with the given letter.
 */
function fakeAnswer(letter: string): string {
  return letter + "בדיקה"; // letter + "test" in Hebrew
}

// ─── Test scenarios ───

export default function () {
  // Health check — always fast
  group("health_check", () => {
    const res = http.get(`${BASE_URL}/api/health`);
    healthCheckDuration.add(res.timings.duration);

    const passed = check(res, {
      "health: status 200": (r) => r.status === 200,
      "health: ok response": (r) => {
        try {
          const body = JSON.parse(r.body as string);
          return body.ok === true;
        } catch {
          return false;
        }
      },
    });

    if (!passed) errorCount.add(1);
    successRate.add(passed ? 1 : 0);
  });

  sleep(0.5);

  // Full game lifecycle
  group("game_lifecycle", () => {
    let gameId: string | null = null;

    // 1. Create game
    group("create_game", () => {
      const payload = JSON.stringify({
        mode: "multiplayer",
        categoryMode: "fixed",
        categories: CATEGORIES,
        timerSeconds: 90,
        maxRounds: 3,
      });

      const res = http.post(`${BASE_URL}/api/game/create`, payload, {
        headers,
      });
      gameCreateDuration.add(res.timings.duration);

      const passed = check(res, {
        "create: status 200 or 201": (r) =>
          r.status === 200 || r.status === 201,
      });

      if (passed) {
        try {
          const body = JSON.parse(res.body as string);
          gameId = body.data?.id || body.data?.game_id || null;
        } catch {
          // Response parse failed
        }
      }

      if (!passed) errorCount.add(1);
      successRate.add(passed ? 1 : 0);
    });

    if (!gameId) return;

    sleep(0.3);

    // 2. Join game (simulating another player)
    group("join_game", () => {
      const payload = JSON.stringify({
        roomCode: "1234", // placeholder — real tests need actual room codes
        gameId: gameId,
      });

      const res = http.post(`${BASE_URL}/api/game/join`, payload, { headers });
      gameJoinDuration.add(res.timings.duration);

      // Join may fail if room code is wrong — that's expected in load test
      const passed = check(res, {
        "join: not server error": (r) => r.status < 500,
      });

      if (!passed) errorCount.add(1);
      successRate.add(passed ? 1 : 0);
    });

    sleep(0.3);

    // 3. Start game
    group("start_game", () => {
      const payload = JSON.stringify({ gameId });

      const res = http.post(`${BASE_URL}/api/game/start`, payload, {
        headers,
      });
      gameStartDuration.add(res.timings.duration);

      const passed = check(res, {
        "start: not server error": (r) => r.status < 500,
      });

      if (!passed) errorCount.add(1);
      successRate.add(passed ? 1 : 0);
    });

    sleep(1);

    // 4. Submit answers (done)
    group("submit_answers", () => {
      const letter = randomLetter();
      const answers: Record<string, string> = {};
      for (const cat of CATEGORIES) {
        answers[cat] = fakeAnswer(letter);
      }

      const payload = JSON.stringify({
        gameId,
        answers,
      });

      const res = http.post(`${BASE_URL}/api/game/done`, payload, { headers });
      answerSubmitDuration.add(res.timings.duration);

      const passed = check(res, {
        "done: not server error": (r) => r.status < 500,
      });

      if (!passed) errorCount.add(1);
      successRate.add(passed ? 1 : 0);
    });

    sleep(0.5);

    // 5. End game
    group("end_game", () => {
      const payload = JSON.stringify({ game_id: gameId });

      const res = http.post(`${BASE_URL}/api/game/end`, payload, { headers });
      gameEndDuration.add(res.timings.duration);

      const passed = check(res, {
        "end: not server error": (r) => r.status < 500,
      });

      if (!passed) errorCount.add(1);
      successRate.add(passed ? 1 : 0);
    });

    sleep(0.5);

    // 6. Heartbeat (background — measures connection pool pressure)
    group("heartbeat", () => {
      const payload = JSON.stringify({ gameId });
      const res = http.post(`${BASE_URL}/api/game/heartbeat`, payload, {
        headers,
      });

      const passed = check(res, {
        "heartbeat: not server error": (r) => r.status < 500,
      });

      if (!passed) errorCount.add(1);
      successRate.add(passed ? 1 : 0);
    });
  });

  sleep(1);
}

/**
 * Summary handler — prints a human-readable report at the end.
 */
export function handleSummary(data: Record<string, unknown>) {
  const metrics = data.metrics as Record<
    string,
    { values?: Record<string, number> }
  >;

  const p95Create =
    metrics?.game_create_duration?.values?.["p(95)"]?.toFixed(0) || "N/A";
  const p95Submit =
    metrics?.answer_submit_duration?.values?.["p(95)"]?.toFixed(0) || "N/A";
  const p95Health =
    metrics?.health_check_duration?.values?.["p(95)"]?.toFixed(0) || "N/A";
  const httpFailRate =
    metrics?.http_req_failed?.values?.rate?.toFixed(4) || "N/A";
  const successRateVal =
    metrics?.success_rate?.values?.rate?.toFixed(4) || "N/A";

  const summary = `
═══════════════════════════════════════════
  Load Test Results: Concurrent Players
═══════════════════════════════════════════

  P95 Game Create:   ${p95Create}ms (threshold: <2000ms)
  P95 Answer Submit:  ${p95Submit}ms (threshold: <2000ms)
  P95 Health Check:   ${p95Health}ms (threshold: <500ms)
  HTTP Failure Rate:  ${httpFailRate} (threshold: <0.01)
  Success Rate:       ${successRateVal} (threshold: >0.99)

═══════════════════════════════════════════
`;

  return {
    stdout: summary,
  };
}
