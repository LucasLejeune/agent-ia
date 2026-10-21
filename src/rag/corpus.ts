import fs from 'node:fs';
import path from 'node:path';

export const SUPPORTED_EXT = new Set(['.md', '.txt', '.json', '.csv', '.pdf']);

/** Résout `rel` dans `corpusDir` ; lève une erreur si le résultat sort du corpus. */
export function resolveInCorpus(corpusDir: string, rel: string): string {
  const root = fs.realpathSync(path.resolve(corpusDir));
  const target = path.resolve(root, rel);
  const inside = (p: string) => p === root || p.startsWith(root + path.sep);
  if (!inside(target)) throw new Error('Chemin hors corpus refusé');
  if (fs.existsSync(target) && !inside(fs.realpathSync(target))) {
    throw new Error('Chemin hors corpus refusé (lien symbolique)');
  }
  return target;
}

export function corpusRoot(corpusDir: string): string {
  return fs.realpathSync(path.resolve(corpusDir));
}

/** Liste récursive des fichiers supportés (chemins absolus). */
export function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (SUPPORTED_EXT.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out.sort();
}

export function toRelative(root: string, abs: string): string {
  return path.relative(root, abs).split(path.sep).join('/');
}
