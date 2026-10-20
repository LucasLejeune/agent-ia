import { getDb } from './index.js';

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function createSession(id: string, userId: string): void {
  getDb().prepare('INSERT INTO sessions (id, user_id) VALUES (?, ?)').run(id, userId);
}
export function sessionOwnedBy(id: string, userId: string): boolean {
  return getDb().prepare('SELECT 1 FROM sessions WHERE id = ? AND user_id = ?').get(id, userId) !== undefined;
}
export function deleteSession(id: string, userId: string): boolean {
  return getDb().prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
}

export function addMessage(sessionId: string, role: 'user' | 'assistant', content: string, toolsUsed: string[] = []): void {
  getDb()
    .prepare('INSERT INTO messages (session_id, role, content, tools_used) VALUES (?, ?, ?, ?)')
    .run(sessionId, role, content, JSON.stringify(toolsUsed));
}

export function getHistory(sessionId: string, limit = 20): HistoryMessage[] {
  return getDb()
    .prepare(
      `SELECT role, content FROM (
         SELECT id, role, content FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?
       ) ORDER BY id ASC`,
    )
    .all(sessionId, limit) as HistoryMessage[];
}

export function listIndexedDocuments(): { path: string; indexed_at: string; chunks: number }[] {
  return getDb()
    .prepare(
      `SELECT d.path, d.indexed_at, COUNT(c.id) AS chunks
       FROM documents d LEFT JOIN chunks c ON c.document_id = d.id
       GROUP BY d.id ORDER BY d.path`,
    )
    .all() as { path: string; indexed_at: string; chunks: number }[];
}
