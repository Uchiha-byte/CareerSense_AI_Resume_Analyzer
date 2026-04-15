import { getDb } from './schema';
import type { AnalysisSession, AnalysisResult } from '../types';

interface CreateSessionData {
  id: string;
  resume: string;
  targetRole: string;
  targetCompanies: string[] | null;
}

export function createSession(data: CreateSessionData): AnalysisSession {
  const db = getDb();
  const createdAt = Math.floor(Date.now() / 1000);
  const expiresAt = createdAt + 604800;

  db.prepare(`
    INSERT INTO analysis_sessions (id, resume, target_role, target_companies, status, result, error, created_at, expires_at)
    VALUES (?, ?, ?, ?, 'pending', NULL, NULL, ?, ?)
  `).run(
    data.id,
    data.resume,
    data.targetRole,
    data.targetCompanies !== null ? JSON.stringify(data.targetCompanies) : null,
    createdAt,
    expiresAt
  );

  return {
    id: data.id,
    resume: data.resume,
    targetRole: data.targetRole,
    targetCompanies: data.targetCompanies,
    status: 'pending',
    result: null,
    error: null,
    createdAt,
    expiresAt,
  };
}

export function updateSession(
  id: string,
  updates: { status: 'complete' | 'error'; result?: AnalysisResult | null; error?: string | null; modelUsed?: string | null }
): void {
  const db = getDb();
  db.prepare(`
    UPDATE analysis_sessions
    SET status = ?, result = ?, error = ?, model_used = ?
    WHERE id = ?
  `).run(
    updates.status,
    updates.result !== undefined ? (updates.result !== null ? JSON.stringify(updates.result) : null) : null,
    updates.error ?? null,
    updates.modelUsed ?? null,
    id
  );
}

interface SessionRow {
  id: string;
  resume: string;
  target_role: string;
  target_companies: string | null;
  status: 'pending' | 'complete' | 'error';
  result: string | null;
  error: string | null;
  created_at: number;
  expires_at: number;
}

export function getSessionById(id: string): AnalysisSession | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM analysis_sessions WHERE id = ?
  `).get(id) as SessionRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    resume: row.resume,
    targetRole: row.target_role,
    targetCompanies: row.target_companies !== null ? JSON.parse(row.target_companies) as string[] : null,
    status: row.status,
    result: row.result !== null ? JSON.parse(row.result) as AnalysisResult : null,
    error: row.error,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export function getAllSessions(): AnalysisSession[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM analysis_sessions ORDER BY created_at DESC
  `).all() as SessionRow[];

  return rows.map(row => ({
    id: row.id,
    resume: row.resume,
    targetRole: row.target_role,
    targetCompanies: row.target_companies !== null ? JSON.parse(row.target_companies) as string[] : null,
    status: row.status,
    result: row.result !== null ? JSON.parse(row.result) as AnalysisResult : null,
    error: row.error,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

export function deleteSession(id: string): void {
  const db = getDb();
  db.prepare(`
    DELETE FROM analysis_sessions WHERE id = ?
  `).run(id);
}
