import { describe, expect, it } from 'vitest';
import { chunkText } from '../src/rag/chunker.js';

const sample = Array.from({ length: 2500 }, (_, i) => String.fromCharCode(97 + (i % 26))).join('');

describe('chunkText', () => {
  it('respecte la taille maximale', () => {
    for (const c of chunkText(sample, 800, 100)) expect(c.length).toBeLessThanOrEqual(800);
  });
  it('produit plusieurs chunks avec recouvrement', () => {
    const chunks = chunkText(sample, 800, 100);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks[1]!.startsWith(chunks[0]!.slice(-100))).toBe(true);
  });
  it('gère un texte vide ou court', () => {
    expect(chunkText('   ', 800, 100)).toEqual([]);
    expect(chunkText('court', 800, 100)).toEqual(['court']);
  });
  it('refuse un overlap >= size', () => {
    expect(() => chunkText('abc', 10, 10)).toThrow();
  });
});
