import { describe, expect, it } from 'vitest';
import { cosine, fromBlob, toBlob } from '../src/rag/similarity.js';

describe('cosine', () => {
  it('vaut 1 pour des vecteurs identiques', () => expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1));
  it('vaut 0 pour des vecteurs orthogonaux', () => expect(cosine([1, 0], [0, 1])).toBeCloseTo(0));
  it('vaut -1 pour des vecteurs opposés', () => expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1));
  it('gère le vecteur nul', () => expect(cosine([0, 0], [1, 1])).toBe(0));
  it('refuse des dimensions différentes', () => expect(() => cosine([1], [1, 2])).toThrow());
});

describe('blob', () => {
  it('fait un aller-retour', () => {
    const v = [0.5, -1.25, 3];
    expect(Array.from(fromBlob(toBlob(v)))).toEqual(v);
  });
});
