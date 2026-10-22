import { describe, expect, it } from 'vitest';
import { isArithmetic, normalizeRoute } from '../src/agent/router.js';

describe('isArithmetic', () => {
  it.each(['12*(3+4)', '123*45+7', ' 2^10 ', '12 + 30 = ?'])('vrai : %s', (t) => expect(isArithmetic(t)).toBe(true));
  it.each(['Bonjour', '2024', '-5', 'Combien font 2+2 ?', ''])('faux : %s', (t) => expect(isArithmetic(t)).toBe(false));
});

describe('normalizeRoute', () => {
  const all = ['sql', 'documents', 'calc', 'web'] as const;
  it('garde les intents disponibles uniquement', () => {
    const r = normalizeRoute({ intents: ['web', 'sql'], databases: ['sales'], reason: 'x' }, ['sql', 'documents', 'calc']);
    expect(r.intents).toEqual(['sql']);
    expect(r.databases).toEqual(['sales']);
  });
  it('ouvre toutes les bases si sql sans base précisée', () => {
    expect(normalizeRoute({ intents: ['sql'], databases: [], reason: '' }, [...all]).databases).toEqual(['sales', 'catalog', 'hr']);
  });
  it('vide les bases sans intent sql', () => {
    expect(normalizeRoute({ intents: ['documents'], databases: ['hr'], reason: '' }, [...all]).databases).toEqual([]);
  });
  it('route vide pour une question générale', () => {
    expect(normalizeRoute({ intents: [], databases: [], reason: 'culture générale' }, [...all]).intents).toEqual([]);
  });
});
