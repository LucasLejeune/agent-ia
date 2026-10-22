import { z } from 'zod';
import { config } from '../config/index.js';
import { DB_NAMES, type DbName } from '../db/business.js';
import type { HistoryMessage } from '../db/repo.js';
import { chat, type ChatMessage } from '../llm/ollama.js';
import type { ToolGroup } from '../tools/registry.js';

export interface Route {
  intents: ToolGroup[];
  databases: DbName[];
  reason: string;
  source: 'rule' | 'llm' | 'fallback' | 'disabled';
}

const RawRoute = z.object({
  intents: z.array(z.enum(['sql', 'documents', 'web', 'calc'])).default([]),
  databases: z.array(z.enum(DB_NAMES)).default([]),
  reason: z.string().default(''),
});
type RawRoute = z.infer<typeof RawRoute>;

export function availableIntents(): ToolGroup[] {
  const base: ToolGroup[] = ['sql', 'documents', 'calc'];
  return config.WEB_SEARCH_PROVIDER === 'none' ? base : [...base, 'web'];
}

/** Vrai pour une expression purement arithmétique (ex: "12*(3+4)"). */
export function isArithmetic(text: string): boolean {
  const t = text.trim();
  return /^[\d\s+\-*/().,%^]+(=\s*\??)?$/.test(t) && /\d/.test(t) && /[+\-*/%^]/.test(t.replace(/^\s*-/, ''));
}

/** Nettoie la sortie du routeur : intents disponibles seulement, bases cohérentes. */
export function normalizeRoute(raw: RawRoute, available: ToolGroup[]): Route {
  const intents = [...new Set(raw.intents)].filter((i) => available.includes(i));
  let databases: DbName[] = intents.includes('sql') ? [...new Set(raw.databases)] : [];
  if (intents.includes('sql') && databases.length === 0) databases = [...DB_NAMES];
  return { intents, databases, reason: raw.reason.slice(0, 200), source: 'llm' };
}

function routerPrompt(available: ToolGroup[]): string {
  const today = new Date().toLocaleDateString('fr-FR', { dateStyle: 'full' });
  const web = available.includes('web');
  return `Tu es un routeur. Décide quels outils sont VRAIMENT nécessaires pour répondre à la question. Date du jour : ${today}.
Réponds UNIQUEMENT en JSON : {"intents":[...],"databases":[...],"reason":"..."}

Intents possibles :
- "sql" : données chiffrées internes de l'entreprise. Bases : sales (clients, commandes, paiements, expéditions, retours, avis, contacts), catalog (produits, prix, stock, catégories, fournisseurs), hr (employés, départements, salaires).
- "documents" : règles, procédures, politiques, conditions, guides internes (retours, livraison, congés, support, sécurité, garantie).
${web ? '- "web" : information externe ou en temps réel : météo, actualités, événements récents, "aujourd\'hui", faits publics récents.\n' : ''}- "calc" : calcul arithmétique explicite.

Règles :
- Culture générale, salutation, reformulation, conseil général, question sur toi : intents = [].
- N'ajoute un intent que s'il est indispensable. "sql" uniquement pour des données de l'entreprise.
- Si "sql", liste les bases utiles dans "databases" (plusieurs si la question croise produits ET commandes, etc.).

Exemples :
"Quelle est la capitale de la France ?" -> {"intents":[],"databases":[],"reason":"culture générale"}
"Bonjour !" -> {"intents":[],"databases":[],"reason":"salutation"}
"Combien de clients avons-nous ?" -> {"intents":["sql"],"databases":["sales"],"reason":"donnée interne"}
"Quel est le prix du Clavier mécanique K1 ?" -> {"intents":["sql"],"databases":["catalog"],"reason":"produit"}
"Combien de commandes contiennent le produit Webcam HD ?" -> {"intents":["sql"],"databases":["sales","catalog"],"reason":"croise commandes et produits"}
"Quel est le délai de retour ?" -> {"intents":["documents"],"databases":[],"reason":"règle interne"}
${web ? '"Quel temps fait-il aujourd\'hui à Lille ?" -> {"intents":["web"],"databases":[],"reason":"météo temps réel"}\n' : ''}"Combien font 12*(3+4) ?" -> {"intents":["calc"],"databases":[],"reason":"calcul"}`;
}

export async function routeQuestion(message: string, history: HistoryMessage[]): Promise<Route> {
  const all = availableIntents();
  const fallback: Route = {
    intents: all,
    databases: [...DB_NAMES],
    reason: 'routage indisponible : tous les outils exposés',
    source: 'fallback',
  };
  if (!config.ROUTER_ENABLED) return { ...fallback, reason: 'routeur désactivé', source: 'disabled' };
  if (isArithmetic(message)) return { intents: ['calc'], databases: [], reason: 'expression arithmétique', source: 'rule' };

  const recent = history
    .slice(-4)
    .map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content.slice(0, 300)}`)
    .join('\n');
  const messages: ChatMessage[] = [
    { role: 'system', content: routerPrompt(all) },
    { role: 'user', content: `${recent ? `Contexte récent :\n${recent}\n\n` : ''}Question : ${message}` },
  ];

  try {
    const reply = await chat(messages, [], { json: true });
    const json: unknown = JSON.parse(reply.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim());
    return normalizeRoute(RawRoute.parse(json), all);
  } catch {
    return fallback;
  }
}
