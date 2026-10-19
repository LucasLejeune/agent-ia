import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveInCorpus } from '../src/rag/corpus.js';

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'corpus-'));
  fs.writeFileSync(path.join(dir, 'a.md'), '# a');
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('resolveInCorpus', () => {
  it('accepte un fichier du corpus', () => {
    expect(resolveInCorpus(dir, 'a.md').endsWith('a.md')).toBe(true);
  });
  it('refuse ../', () => {
    expect(() => resolveInCorpus(dir, '../../etc/passwd')).toThrow();
  });
  it('refuse un chemin absolu externe', () => {
    expect(() => resolveInCorpus(dir, '/etc/passwd')).toThrow();
  });
  it('refuse un préfixe voisin (corpus-evil)', () => {
    expect(() => resolveInCorpus(dir, path.join('..', path.basename(dir) + '-evil', 'x'))).toThrow();
  });
});
