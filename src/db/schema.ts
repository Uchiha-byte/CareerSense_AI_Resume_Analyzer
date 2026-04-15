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

  return db;
}
