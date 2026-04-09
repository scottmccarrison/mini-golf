CREATE TABLE IF NOT EXISTS scores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  score       INTEGER NOT NULL,
  course_par  INTEGER NOT NULL DEFAULT 30,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score ASC);
