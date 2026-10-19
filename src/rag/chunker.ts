/**
 * Découpe un texte en chunks de taille maximale `size`, avec `overlap` caractères
 * de recouvrement. Essaie de couper sur un saut de ligne ou une fin de phrase.
 */
export function chunkText(text: string, size: number, overlap: number): string[] {
  if (size <= 0) throw new Error('size doit être > 0');
  if (overlap < 0 || overlap >= size) throw new Error('overlap doit être dans [0, size[');

  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const brk = Math.max(clean.lastIndexOf('\n\n', end), clean.lastIndexOf('\n', end), clean.lastIndexOf('. ', end));
      if (brk > start + size * 0.5) end = brk + 1;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    const next = end - overlap;
    start = next > start ? next : end;
  }
  return chunks;
}
