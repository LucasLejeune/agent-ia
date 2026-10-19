import { describe, expect, it } from 'vitest';
import { calculate } from '../src/tools/calculator.js';

describe('calculate', () => {
  it('respecte les priorités', () => expect(calculate('123*45+7')).toBe(5542));
  it('gère les parenthèses', () => expect(calculate('(2+3)*4')).toBe(20));
  it('gère les puissances et décimaux', () => {
    expect(calculate('2^10')).toBe(1024);
    expect(calculate('1.5*2')).toBe(3);
  });
  it('refuse la division par zéro', () => expect(() => calculate('1/0')).toThrow());
  it('refuse le code', () => {
    expect(() => calculate('process.exit()')).toThrow();
    expect(() => calculate('require("fs")')).toThrow();
  });
  it('refuse une expression malformée', () => expect(() => calculate('2 3')).toThrow());
});
