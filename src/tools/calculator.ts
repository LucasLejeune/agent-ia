/** Évaluateur arithmétique par descente récursive. Jamais d'eval(). */
export function calculate(expr: string): number {
  if (!/^[0-9+\-*/().%^\s]+$/.test(expr)) throw new Error('Expression invalide : caractères non autorisés');
  const tokens = expr.match(/\d+\.?\d*|\.\d+|[-+*/()^%]/g) ?? [];
  let pos = 0;
  const peek = (): string | undefined => tokens[pos];
  const next = (): string | undefined => tokens[pos++];

  function parseExpr(): number {
    let v = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      const r = parseTerm();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function parseTerm(): number {
    let v = parsePow();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = next();
      const r = parsePow();
      if (op === '*') v *= r;
      else if (r === 0) throw new Error('Division par zéro');
      else v = op === '/' ? v / r : v % r;
    }
    return v;
  }
  function parsePow(): number {
    const base = parseUnary();
    if (peek() === '^') {
      next();
      return base ** parsePow();
    }
    return base;
  }
  function parseUnary(): number {
    if (peek() === '-') {
      next();
      return -parseUnary();
    }
    if (peek() === '+') {
      next();
      return parseUnary();
    }
    return parsePrimary();
  }
  function parsePrimary(): number {
    const t = next();
    if (t === undefined) throw new Error('Expression incomplète');
    if (t === '(') {
      const v = parseExpr();
      if (next() !== ')') throw new Error('Parenthèse fermante manquante');
      return v;
    }
    const n = Number(t);
    if (Number.isNaN(n)) throw new Error(`Jeton inattendu : ${t}`);
    return n;
  }

  const result = parseExpr();
  if (pos < tokens.length) throw new Error('Expression invalide');
  return result;
}
