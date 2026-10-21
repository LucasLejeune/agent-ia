const NUMBER = /\d+(?:[.,]\d+)?/g;

/** "1 234,50" -> "1234,50" : retire les séparateurs de milliers (espaces). */
function normalize(text: string): string {
  return text.replace(/(\d)[\s\u00a0\u202f](?=\d{3}(?!\d))/g, '$1');
}

export function extractNumbers(text: string): number[] {
  return (normalize(text).match(NUMBER) ?? [])
    .map((t) => Number(t.replace(',', '.')))
    .filter((n) => Number.isFinite(n));
}

export interface NumberCheck {
  checked: number[];
  unsupported: number[];
}

/**
 * Vérifie que chaque nombre de la réponse apparaît dans les preuves
 * (résultats d'outils, extraits de documents, question).
 * Les petits entiers (<= ignoreUpTo) sont ignorés : numérotation, "3 clients"...
 */
export function checkNumbers(answer: string, evidence: string[], ignoreUpTo = 10): NumberCheck {
  const known = evidence.flatMap(extractNumbers);
  const checked = [...new Set(extractNumbers(answer))].filter((n) => !(Number.isInteger(n) && n <= ignoreUpTo));
  const unsupported = checked.filter((n) => !known.some((k) => Math.abs(k - n) < 0.01));
  return { checked, unsupported };
}
