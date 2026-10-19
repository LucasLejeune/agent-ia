import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { config } from '../config/index.js';
import { getReadonlyDb } from '../db/index.js';
import { corpusRoot, resolveInCorpus, SUPPORTED_EXT, toRelative, walk } from '../rag/corpus.js';
import { calculate } from './calculator.js';
import { defineTool, ToolRegistry } from './registry.js';
import { validateSelect } from './sqlGuard.js';

export const ALLOWED_TABLES = ['contacts'];
const MAX_FILE_CHARS = 6000;
const MAX_ROWS = 50;

const listDocuments = defineTool({
  name: 'list_documents',
  description: 'Liste les fichiers disponibles dans le corpus documentaire.',
  parameters: { type: 'object', properties: {} },
  schema: z.object({}).passthrough(),
  run: () => {
    const root = corpusRoot(config.CORPUS_DIR);
    return { files: walk(root).map((f) => toRelative(root, f)) };
  },
});

const readFile = defineTool({
  name: 'read_file',
  description: 'Lit le contenu d\'un fichier du corpus (chemin relatif, ex: faq.md).',
  parameters: {
    type: 'object',
    properties: { path: { type: 'string', description: 'Chemin relatif au corpus' } },
    required: ['path'],
  },
  schema: z.object({ path: z.string().min(1) }),
  run: ({ path: rel }) => {
    const abs = resolveInCorpus(config.CORPUS_DIR, rel);
    if (!SUPPORTED_EXT.has(path.extname(abs).toLowerCase())) throw new Error('Extension non autorisée');
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new Error(`Fichier introuvable : ${rel}`);
    const text = fs.readFileSync(abs, 'utf8');
    return { path: rel, truncated: text.length > MAX_FILE_CHARS, content: text.slice(0, MAX_FILE_CHARS) };
  },
});

const sqlQuery = defineTool({
  name: 'sql_query',
  description:
    'Exécute une requête SQL SELECT en lecture seule. Table disponible : contacts(id, name, email, city, company).',
  parameters: {
    type: 'object',
    properties: { sql: { type: 'string', description: 'Requête SELECT unique' } },
    required: ['sql'],
  },
  schema: z.object({ sql: z.string().min(1) }),
  run: ({ sql }) => {
    const safe = validateSelect(sql, ALLOWED_TABLES);
    const rows = getReadonlyDb().prepare(`SELECT * FROM (${safe}) LIMIT ${MAX_ROWS}`).all();
    return { rowCount: rows.length, rows };
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

export const registry = new ToolRegistry().register(listDocuments).register(readFile).register(sqlQuery).register(calculator);
