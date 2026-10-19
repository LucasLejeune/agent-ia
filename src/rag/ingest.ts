import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { getDb } from '../db/index.js';
import { HttpError } from '../errors.js';
import { embed } from '../llm/ollama.js';
import { chunkText } from './chunker.js';
import { corpusRoot, resolveInCorpus, SUPPORTED_EXT, toRelative, walk } from './corpus.js';
import { toBlob } from './similarity.js';

const BATCH = 16;

function readAsText(abs: string): string {
  const raw = fs.readFileSync(abs, 'utf8');
  if (path.extname(abs).toLowerCase() === '.json') {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }
  return raw;
}

export interface IngestResult {
  indexed: string[];
  unchanged: string[];
  skipped: string[];
}

export async function ingestPath(rel = '.'): Promise<IngestResult> {
  let target: string;
  try {
    target = resolveInCorpus(config.CORPUS_DIR, rel);
  } catch (e) {
    throw new HttpError(403, (e as Error).message);
  }
  if (!fs.existsSync(target)) throw new HttpError(404, `Introuvable dans le corpus : ${rel}`);

  const root = corpusRoot(config.CORPUS_DIR);
  const files = fs.statSync(target).isDirectory() ? walk(target) : [target];
  const db = getDb();
  const result: IngestResult = { indexed: [], unchanged: [], skipped: [] };

  for (const abs of files) {
    const relPath = toRelative(root, abs);
    if (!SUPPORTED_EXT.has(path.extname(abs).toLowerCase())) {
      result.skipped.push(relPath);
      continue;
    }
    const text = readAsText(abs);
    const hash = createHash('sha256').update(text).digest('hex');
    const existing = db.prepare('SELECT hash FROM documents WHERE path = ?').get(relPath) as { hash: string } | undefined;
    if (existing?.hash === hash) {
      result.unchanged.push(relPath);
      continue;
    }

    const chunks = chunkText(text, config.CHUNK_SIZE, config.CHUNK_OVERLAP);
    const vectors: number[][] = [];
    for (let i = 0; i < chunks.length; i += BATCH) {
      vectors.push(...(await embed(chunks.slice(i, i + BATCH))));
    }

    db.transaction(() => {
      db.prepare('DELETE FROM documents WHERE path = ?').run(relPath);
      const { lastInsertRowid } = db.prepare('INSERT INTO documents (path, hash) VALUES (?, ?)').run(relPath, hash);
      const insert = db.prepare('INSERT INTO chunks (document_id, idx, content, embedding) VALUES (?, ?, ?, ?)');
      chunks.forEach((content, idx) => insert.run(lastInsertRowid, idx, content, toBlob(vectors[idx] as number[])));
    })();
    result.indexed.push(relPath);
  }
  return result;
}
