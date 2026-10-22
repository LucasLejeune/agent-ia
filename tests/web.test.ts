import { describe, expect, it } from 'vitest';
import { normalizeResults } from '../src/tools/webSearch.js';

describe('normalizeResults', () => {
  it('déduplique, borne et ignore les URL invalides', () => {
    const items = [
      { title: 'A', url: 'https://a.example', content: 'x'.repeat(2000) },
      { title: 'A bis', url: 'https://a.example', content: 'doublon' },
      { title: 'B', url: 'javascript:alert(1)', content: 'mauvais' },
      { title: 'C', url: 'http://c.example', content: 'ok' },
    ];
    const out = normalizeResults(items, 5);
    expect(out.map((r) => r.url)).toEqual(['https://a.example', 'http://c.example']);
    expect(out[0]!.content.length).toBe(500);
  });
  it('respecte le maximum', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ title: `T${i}`, url: `https://x.example/${i}`, content: '' }));
    expect(normalizeResults(items, 3)).toHaveLength(3);
  });
  it('gère une entrée invalide', () => {
    expect(normalizeResults(undefined, 5)).toEqual([]);
  });
});
