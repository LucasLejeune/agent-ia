import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { getDb } from '../db/index.js';
import { HttpError } from '../errors.js';
import { embed } from '../llm/ollama.js';
import { chunkText } from './chunker.js';
import { corpusRoot, resolveInCorpus, SUPPORTED_EXT, toRelative, walk } from './corpus.js';
import { loadDocument } from './loader.js';
import { toBlob } from './similarity.js';

const BATCH = 16;

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

    let parts;
    try {
      parts = await loadDocument(abs);
    } catch (e) {
      result.skipped.push(`${relPath} (lecture impossible : ${(e as Error).message})`);
      continue;
    }
    if (parts.length === 0) {
      result.skipped.push(`${relPath} (aucun texte extractible)`);
      continue;
    }

    const hash = createHash('sha256').update(parts.map((p) => p.text).join('\n')).digest('hex');
    const existing = db.prepare('SELECT hash FROM documents WHERE path = ?').get(relPath) as { hash: string } | undefined;
    if (existing?.hash === hash) {
      result.unchanged.push(relPath);
      continue;
    }

    const pieces = parts.flatMap((p) =>
      chunkText(p.text, config.CHUNK_SIZE, config.CHUNK_OVERLAP).map((content) => ({ page: p.page, content })),
    );
    const vectors: number[][] = [];
    for (let i = 0; i < pieces.length; i += BATCH) {
      vectors.push(...(await embed(pieces.slice(i, i + BATCH).map((p) => p.content))));
    }

    db.transaction(() => {
      const doc = db.prepare('SELECT id FROM documents WHERE path = ?').get(relPath) as { id: number } | undefined;
      let docId: number;
      if (doc) {
        docId = doc.id;
        db.prepare('DELETE FROM chunks WHERE document_id = ?').run(docId);
        db.prepare('UPDATE documents SET hash = ?, indexed_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, docId);
      } else {
        docId = Number(db.prepare('INSERT INTO documents (path, hash) VALUES (?, ?)').run(relPath, hash).lastInsertRowid);
      }
      const insert = db.prepare(
        'INSERT INTO chunks (document_id, idx, page, content, embedding) VALUES (?, ?, ?, ?, ?)',
      );
      pieces.forEach((p, idx) => insert.run(docId, idx, p.page, p.content, toBlob(vectors[idx] as number[])));
    })();
    result.indexed.push(relPath);
  }
  return result;
}
