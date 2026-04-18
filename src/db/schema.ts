import Database from 'better-sqlite3';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH ?? path.resolve('careersense.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_sessions (
        id          TEXT PRIMARY KEY,
        input_hash  TEXT,
        resume      TEXT NOT NULL,
        target_role TEXT NOT NULL,
        target_companies TEXT,
        status      TEXT NOT NULL DEFAULT 'pending',
        result      TEXT,
        error       TEXT,
        model_used  TEXT,
        created_at  INTEGER NOT NULL,
        expires_at  INTEGER NOT NULL
    );
  `);

  // Back-compat for existing DB files: add input_hash if missing.
  // better-sqlite3 will throw if the column already exists; ignore that.
  try {
    db.exec(`ALTER TABLE analysis_sessions ADD COLUMN input_hash TEXT;`);
  } catch {
    // ignore
  }

  // Indexes (create after back-compat migration)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_analysis_sessions_input_hash ON analysis_sessions(input_hash);
    CREATE INDEX IF NOT EXISTS idx_analysis_sessions_status_created_at ON analysis_sessions(status, created_at DESC);
  `);

  return db;
}
