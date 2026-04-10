-- Word dictionary for answer validation.
-- Primary source of truth for production; SQLite is used locally.
CREATE TABLE words (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  letter TEXT NOT NULL,
  category TEXT NOT NULL,
  word TEXT NOT NULL,
  normalized TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'seed',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(letter, category, normalized)
);

CREATE INDEX idx_words_lookup ON words(letter, category, normalized);
CREATE INDEX idx_words_letter ON words(letter);
CREATE INDEX idx_words_category ON words(category);

-- RLS: words are readable by everyone, writable only via service role
ALTER TABLE words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Words are readable by everyone"
  ON words FOR SELECT USING (true);
