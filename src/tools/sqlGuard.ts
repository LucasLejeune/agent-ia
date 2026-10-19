const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|attach|detach|pragma|replace|vacuum|reindex|load_extension)\b/i;

/** Valide une requête SELECT mono-instruction sur des tables autorisées. */
export function validateSelect(sql: string, allowedTables: string[]): string {
  const s = sql.trim().replace(/;+\s*$/, '');
  if (!s) throw new Error('Requête vide');
  if (s.includes(';')) throw new Error('Une seule instruction autorisée');
  if (/--|\/\*/.test(s)) throw new Error('Commentaires SQL interdits');
  if (/["`\[\]]/.test(s)) throw new Error('Identifiants quotés interdits');
  if (!/^select\b/i.test(s)) throw new Error('Seules les requêtes SELECT sont autorisées');
  if (FORBIDDEN.test(s)) throw new Error('Mot-clé SQL interdit');
  if (/\bfrom\s+[\w.]+(\s+(as\s+)?\w+)?\s*,/i.test(s)) throw new Error('Jointure par virgule interdite, utiliser JOIN');

  const tables = [...s.matchAll(/\b(?:from|join)\s+([a-zA-Z_][\w]*)/gi)].map((m) => (m[1] as string).toLowerCase());
  if (tables.length === 0) throw new Error('Aucune table référencée');
  const allowed = allowedTables.map((t) => t.toLowerCase());
  for (const t of tables) {
    if (!allowed.includes(t)) throw new Error(`Table non autorisée : ${t}`);
  }
  return s;
}
