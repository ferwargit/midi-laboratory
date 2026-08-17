export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    strategy_id TEXT NOT NULL,
    instrument_id TEXT NOT NULL,
    preset_name TEXT NOT NULL,
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    accuracy_percentage INTEGER NOT NULL,
    avg_response_time_ms INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS exercise_answers (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    question_index INTEGER NOT NULL,
    expected_note INTEGER NOT NULL,
    played_note INTEGER NOT NULL,
    is_correct INTEGER NOT NULL,
    semitone_distance INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    velocity INTEGER NOT NULL,
    reason_telemetry TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_answers_session ON exercise_answers(session_id);
  CREATE INDEX IF NOT EXISTS idx_answers_expected ON exercise_answers(expected_note);
`

export const CLEAR_ALL_DATA_SQL = `
  DELETE FROM exercise_answers;
  DELETE FROM sessions;
  VACUUM;
`
