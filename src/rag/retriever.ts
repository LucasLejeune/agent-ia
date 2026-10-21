import type { AuthUser } from '../auth/access.js';
import { config } from '../config/index.js';
import { getDb } from '../db/index.js';
import { embed } from '../llm/ollama.js';
import { cosine, fromBlob } from './similarity.js';

export interface Source {
  path: string;
  page: number | null;
  score: number;
  content: string;
}

interface Row {
  content: string;
  embedding: Buffer;
  page: number | null;
  path: string;
}

export async function retrieve(query: string, user: AuthUser, k = config.RAG_TOP_K): Promise<Source[]> {
  const base =
    'SELECT c.content, c.embedding, c.page, d.path FROM chunks c JOIN documents d ON d.id = c.document_id';
  const db = getDb();
  const rows = (
    user.role === 'admin'
      ? db.prepare(base).all()
      : db.prepare(base + ' JOIN document_access a ON a.document_id = d.id WHERE a.user_id = ?').all(user.id)
  ) as Row[];
  if (rows.length === 0) return [];

  const [q] = await embed([query]);
  if (!q) return [];

  return rows
    .map((r) => ({ path: r.path, page: r.page, content: r.content, score: cosine(q, fromBlob(r.embedding)) }))
    .filter((s) => s.score >= config.RAG_MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
