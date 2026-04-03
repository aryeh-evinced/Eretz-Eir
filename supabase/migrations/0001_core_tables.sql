-- 0001_core_tables.sql
-- Core game tables, matching lib/types/game.ts contracts exactly.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ---------------------------------------------------------------------------
-- Custom types / domains
-- ---------------------------------------------------------------------------
CREATE TYPE game_mode     AS ENUM ('solo', 'multiplayer');
CREATE TYPE category_mode AS ENUM ('fixed', 'custom', 'random');
CREATE TYPE game_status   AS ENUM ('waiting', 'playing', 'finished');
CREATE TYPE round_status  AS ENUM ('playing', 'reviewing', 'manual_review', 'completed');
CREATE TYPE round_end_reason AS ENUM ('timer', 'all_done');
CREATE TYPE help_used     AS ENUM ('none', 'hint', 'full');
CREATE TYPE age_group     AS ENUM ('child', 'teen', 'adult');
CREATE TYPE room_status   AS ENUM ('waiting', 'playing', 'finished');

-- ---------------------------------------------------------------------------
-- players  (matches PlayerProfile)
-- ---------------------------------------------------------------------------
CREATE TABLE players (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  avatar      text        NOT NULL DEFAULT '',
  age_group   age_group   NOT NULL DEFAULT 'child',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- player_stats  (matches PlayerStats)
-- ---------------------------------------------------------------------------
CREATE TABLE player_stats (
  player_id             uuid     PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  games_played          integer  NOT NULL DEFAULT 0,
  games_won             integer  NOT NULL DEFAULT 0,
  total_score           integer  NOT NULL DEFAULT 0,
  avg_score_per_round   numeric  NOT NULL DEFAULT 0,
  unique_answers_count  integer  NOT NULL DEFAULT 0,
  fastest_answer_ms     integer,            -- nullable: no answer yet
  strongest_category    text,               -- nullable: Category | null
  weakest_category      text                -- nullable: Category | null
);

-- ---------------------------------------------------------------------------
-- rooms  (multiplayer lobby)
-- ---------------------------------------------------------------------------
CREATE TABLE rooms (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        char(4)     NOT NULL CHECK (code ~ '^[0-9]{4}$'),
  status      room_status NOT NULL DEFAULT 'waiting',
  created_by  uuid        NOT NULL REFERENCES players(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Unique room code among active (non-finished) rooms.
-- Defined here; the partial unique index lives in 0002_indexes.sql.

-- ---------------------------------------------------------------------------
-- game_sessions  (matches GameSession)
-- ---------------------------------------------------------------------------
CREATE TABLE game_sessions (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  mode            game_mode     NOT NULL,
  status          game_status   NOT NULL DEFAULT 'waiting',
  category_mode   category_mode NOT NULL DEFAULT 'fixed',
  categories      text[]        NOT NULL,   -- Category[]
  timer_seconds   integer       NOT NULL CHECK (timer_seconds > 0),
  helps_per_round integer       NOT NULL DEFAULT 2 CHECK (helps_per_round >= 0),
  created_by      uuid          NOT NULL REFERENCES players(id),
  created_at      timestamptz   NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  room_id         uuid          REFERENCES rooms(id)
);

-- ---------------------------------------------------------------------------
-- game_players  (many-to-many: game_sessions ↔ players)
-- ---------------------------------------------------------------------------
CREATE TABLE game_players (
  game_id         uuid        NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id       uuid        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  score_total     integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (game_id, player_id)
);

-- ---------------------------------------------------------------------------
-- rounds  (matches Round)
-- ---------------------------------------------------------------------------
CREATE TABLE rounds (
  id            uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       uuid             NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  round_number  integer          NOT NULL CHECK (round_number > 0),
  letter        char(1)          NOT NULL,
  categories    text[]           NOT NULL,
  status        round_status     NOT NULL DEFAULT 'playing',
  started_at    timestamptz      NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  ended_by      round_end_reason,
  UNIQUE (game_id, round_number)
);

-- ---------------------------------------------------------------------------
-- answers  (matches Answer)
-- ---------------------------------------------------------------------------
CREATE TABLE answers (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id          uuid        NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id         uuid        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  category          text        NOT NULL,
  answer_text       text,
  submitted_at      timestamptz,
  is_valid          boolean,
  starts_with_letter boolean,
  is_real_word      boolean,
  matches_category  boolean,
  ai_explanation    text,
  is_unique         boolean,
  help_used         help_used   NOT NULL DEFAULT 'none',
  speed_bonus       boolean     NOT NULL DEFAULT false,
  score             integer     NOT NULL DEFAULT 0,
  UNIQUE (round_id, player_id, category)
);

-- ---------------------------------------------------------------------------
-- rate_limits  (server-internal; all client access blocked via RLS)
-- ---------------------------------------------------------------------------
CREATE TABLE rate_limits (
  key         text        PRIMARY KEY,
  count       integer     NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- stats_refresh_queue  (async stats aggregation; no direct client writes)
-- ---------------------------------------------------------------------------
CREATE TABLE stats_refresh_queue (
  player_id   uuid        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  queued_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id)
);

-- ---------------------------------------------------------------------------
-- job_health  (scheduled function heartbeats)
-- ---------------------------------------------------------------------------
CREATE TABLE job_health (
  job_name        text        PRIMARY KEY,
  last_success_at timestamptz NOT NULL DEFAULT now(),
  last_error      text,
  run_count       integer     NOT NULL DEFAULT 0
);

-- Pre-populate known job names so health checks can detect never-run functions
INSERT INTO job_health (job_name) VALUES
  ('room-cleanup'),
  ('round-backstop'),
  ('presence-scan'),
  ('stats-refresh'),
  ('retention-cleanup');
