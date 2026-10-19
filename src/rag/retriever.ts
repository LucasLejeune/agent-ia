import { config } from '../config/index.js';
import { getDb } from '../db/index.js';
import { embed } from '../llm/ollama.js';
import { cosine, fromBlob } from './similarity.js';

export interface Source {
  path: string;
  score: number;
  content: string;
}

interface Row {
  content: string;
  embedding: Buffer;
  path: string;
}

export async function retrieve(query: string, k = config.RAG_TOP_K): Promise<Source[]> {
  const rows = getDb()
    .prepare('SELECT c.content, c.embedding, d.path FROM chunks c JOIN documents d ON d.id = c.document_id')
    .all() as Row[];
  if (rows.length === 0) return [];

  const [q] = await embed([query]);
  if (!q) return [];

  return rows
    .map((r) => ({ path: r.path, content: r.content, score: cosine(q, fromBlob(r.embedding)) }))
    .filter((s) => s.score >= config.RAG_MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
