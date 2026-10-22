import { config } from '../config/index.js';

export interface WebResult {
  title: string;
  url: string;
  content: string;
}

const clip = (v: unknown, n: number): string => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Nettoie, déduplique par URL et borne la taille des résultats (fonction pure, testable). */
export function normalizeResults(items: unknown, max: number): WebResult[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: WebResult[] = [];
  for (const it of items as Record<string, unknown>[]) {
    const url = clip(it?.url, 500);
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push({ title: clip(it.title, 200) || url, url, content: clip(it.content, 500) });
    if (out.length >= max) break;
  }
  return out;
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(config.WEB_TIMEOUT_MS) });
  } catch (e) {
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw new Error(`Recherche web : timeout après ${config.WEB_TIMEOUT_MS} ms`);
    }
    throw new Error('Recherche web : service injoignable');
  }
  if (!res.ok) {
    const hint = res.status === 403 && config.WEB_SEARCH_PROVIDER === 'searxng' ? ' (format json activé dans settings.yml ?)' : '';
    throw new Error(`Recherche web : HTTP ${res.status}${hint}`);
  }
  return res.json();
}

export async function webSearch(query: string, max: number): Promise<WebResult[]> {
  if (config.WEB_SEARCH_PROVIDER === 'ollama') {
    const data = (await fetchJson('https://ollama.com/api/web_search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.OLLAMA_API_KEY}` },
      body: JSON.stringify({ query, max_results: max }),
    })) as { results?: unknown };
    return normalizeResults(data.results, max);
  }
  if (config.WEB_SEARCH_PROVIDER === 'searxng') {
    const url = new URL('/search', config.SEARXNG_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('language', 'fr');
    const data = (await fetchJson(url.toString(), { method: 'GET' })) as { results?: unknown };
    return normalizeResults(data.results, max);
  }
  throw new Error('Recherche web désactivée (WEB_SEARCH_PROVIDER=none)');
}
