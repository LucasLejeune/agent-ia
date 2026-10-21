import { describe, expect, it } from 'vitest';
import { checkNumbers, extractNumbers } from '../src/verify/numbers.js';

describe('extractNumbers', () => {
  it('gère la virgule décimale et les milliers', () => {
    expect(extractNumbers('1 234,50 €')).toEqual([1234.5]);
    expect(extractNumbers('12 345 678')).toEqual([12345678]);
  });
  it('gère le point décimal', () => expect(extractNumbers('prix 89.90')).toEqual([89.9]));
});

describe('checkNumbers', () => {
  it('accepte un nombre présent dans les preuves', () => {
    expect(checkNumbers('Le total est 5542', ['{"result":5542}']).unsupported).toEqual([]);
  });
  it('tolère les formats différents (89,90 vs 89.9)', () => {
    expect(checkNumbers('Prix : 89,90 €', ['{"price":89.9}']).unsupported).toEqual([]);
  });
  it('signale un nombre inventé', () => {
    expect(checkNumbers('Le total est 9999', ['{"result":5542}']).unsupported).toEqual([9999]);
  });
  it('ignore les petits entiers', () => {
    expect(checkNumbers('Il y a 3 clients', ['{"rowCount":3}']).unsupported).toEqual([]);
    expect(checkNumbers('Il y a 4 clients', []).unsupported).toEqual([]);
  });
  it('compte les nombres de la question comme connus', () => {
    expect(checkNumbers('123*45+7 = 5542', ['123*45+7', '{"result":5542}']).unsupported).toEqual([]);
  });
});
