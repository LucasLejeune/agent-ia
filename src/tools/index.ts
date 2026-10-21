import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { accessibleDocuments, canReadDocument, type AuthUser } from '../auth/access.js';
import { config } from '../config/index.js';
import { getReadonlyDb } from '../db/index.js';
import { corpusRoot, resolveInCorpus, SUPPORTED_EXT, toRelative } from '../rag/corpus.js';
import { loadDocument } from '../rag/loader.js';
import { retrieve } from '../rag/retriever.js';
import { calculate } from './calculator.js';
import { defineTool, ToolRegistry } from './registry.js';
import { validateSelect } from './sqlGuard.js';

const ADMIN_TABLES = [
  'categories', 'suppliers', 'products', 'departments', 'employees', 'customers',
  'orders', 'order_items', 'payments', 'shipments', 'reviews', 'returns', 'contacts',
];
const USER_TABLES = ['categories', 'suppliers', 'products', 'reviews'];

/** Tables SQL accessibles selon le rôle. Les tables internes (users, tokens...) n'y sont jamais. */
export const tablesFor = (user: AuthUser): string[] => (user.role === 'admin' ? ADMIN_TABLES : USER_TABLES);

const MAX_FILE_CHARS = 6000;
const MAX_ROWS = 50;

const listDocuments = defineTool({
  name: 'list_documents',
  description: 'Liste les fichiers du dossier documents auxquels l\'utilisateur a accès (PDF, MD, TXT, CSV, JSON).',
  parameters: { type: 'object', properties: {} },
  schema: z.object({}).passthrough(),
  run: (_args, { user }) => ({ files: accessibleDocuments(user) }),
});

const searchDocuments = defineTool({
  name: 'search_documents',
  description:
    'Recherche sémantique dans les documents (PDF inclus). Renvoie des extraits avec le fichier et la page. À utiliser pour toute question sur des règles, procédures, conditions, politiques.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Texte à rechercher' },
      topK: { type: 'number', description: 'Nombre d\'extraits (1 à 8, défaut 4)' },
    },
    required: ['query'],
  },
  schema: z.object({ query: z.string().min(2), topK: z.coerce.number().int().min(1).max(8).default(4) }),
  run: async ({ query, topK }, { user }) => {
    const found = await retrieve(query, user, topK);
    return {
      results: found.map((s) => ({
        path: s.path,
        page: s.page,
        score: Number(s.score.toFixed(3)),
        excerpt: s.content.slice(0, 500),
      })),
    };
  },
});

const readFile = defineTool({
  name: 'read_file',
  description: 'Lit un document du dossier documents (chemin relatif). Pour un PDF, on peut demander une page précise.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Chemin relatif, ex: guide_livraison.pdf' },
      page: { type: 'number', description: 'Numéro de page (PDF uniquement, optionnel)' },
    },
    required: ['path'],
  },
  schema: z.object({ path: z.string().min(1), page: z.coerce.number().int().positive().optional() }),
  run: async ({ path: rel, page }, { user }) => {
    const root = corpusRoot(config.CORPUS_DIR);
    const abs = resolveInCorpus(config.CORPUS_DIR, rel);
    const relPath = toRelative(root, abs);
    if (!canReadDocument(user, relPath)) throw new Error('Accès refusé ou document non indexé');
    if (!SUPPORTED_EXT.has(path.extname(abs).toLowerCase())) throw new Error('Extension non autorisée');
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new Error(`Fichier introuvable : ${rel}`);

    const parts = await loadDocument(abs);
    const selected = page ? parts.filter((p) => p.page === page) : parts;
    if (selected.length === 0) throw new Error('Page introuvable');
    const text = selected.map((p) => (p.page ? `[page ${p.page}]\n` : '') + p.text).join('\n\n');
    return { path: relPath, truncated: text.length > MAX_FILE_CHARS, content: text.slice(0, MAX_FILE_CHARS) };
  },
});

const describeSchema = defineTool({
  name: 'describe_schema',
  description:
    'Décrit les tables SQL disponibles (colonnes et clés étrangères). À appeler AVANT sql_query pour connaître les noms exacts.',
  parameters: { type: 'object', properties: {} },
  schema: z.object({}).passthrough(),
  run: (_args, { user }) => {
    const db = getReadonlyDb();
    return {
      tables: tablesFor(user).map((t) => {
        const cols = db.prepare(`PRAGMA table_info(${t})`).all() as { name: string; type: string; pk: number }[];
        const fks = db.prepare(`PRAGMA foreign_key_list(${t})`).all() as { from: string; table: string; to: string }[];
        return {
          table: t,
          columns: cols.map((c) => `${c.name} ${c.type}${c.pk ? ' PK' : ''}`),
          foreignKeys: fks.map((f) => `${f.from} -> ${f.table}.${f.to}`),
        };
      }),
    };
  },
});

const sqlQuery = defineTool({
  name: 'sql_query',
  description:
    'Exécute UNE requête SQL SELECT en lecture seule (jointures JOIN autorisées, pas de virgule entre tables). Utiliser les agrégats SQL (COUNT, SUM, AVG) plutôt que de calculer soi-même. Appeler describe_schema d\'abord.',
  parameters: {
    type: 'object',
    properties: { sql: { type: 'string', description: 'Requête SELECT unique' } },
    required: ['sql'],
  },
  schema: z.object({ sql: z.string().min(1) }),
  run: ({ sql }, { user }) => {
    const safe = validateSelect(sql, tablesFor(user));
    const rows = getReadonlyDb().prepare(`SELECT * FROM (${safe}) LIMIT ${MAX_ROWS}`).all();
    return { sql: safe, rowCount: rows.length, rows };
  },
});

const calculator = defineTool({
  name: 'calculator',
  description: 'Évalue une expression arithmétique (+ - * / % ^ et parenthèses).',
  parameters: {
    type: 'object',
    properties: { expression: { type: 'string', description: 'Ex: (12+3)*4' } },
    required: ['expression'],
  },
  schema: z.object({ expression: z.string().min(1) }),
  run: ({ expression }) => ({ expression, result: calculate(expression) }),
});

export const registry = new ToolRegistry()
  .register(listDocuments)
  .register(searchDocuments)
  .register(readFile)
  .register(describeSchema)
  .register(sqlQuery)
  .register(calculator);
