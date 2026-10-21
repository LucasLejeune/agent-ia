import fs from 'node:fs';
import path from 'node:path';
import { extractText, getDocumentProxy } from 'unpdf';

export interface DocPart {
  page: number | null;
  text: string;
}

/** Charge un fichier du corpus. Les PDF sont découpés page par page. */
export async function loadDocument(abs: string): Promise<DocPart[]> {
  const ext = path.extname(abs).toLowerCase();

  if (ext === '.pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(fs.readFileSync(abs)));
    const { text } = await extractText(pdf, { mergePages: false });
    return text
      .map((t, i) => ({ page: i + 1, text: t.trim() }))
      .filter((p) => p.text.length > 0);
  }

  const raw = fs.readFileSync(abs, 'utf8');
  let text = raw;
  if (ext === '.json') {
    try {
      text = JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      // JSON invalide : on indexe le texte brut
    }
  }
  return text.trim() ? [{ page: null, text }] : [];
}
