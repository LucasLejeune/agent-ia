import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { CATALOG_SCHEMA, HR_SCHEMA, SALES_SCHEMA } from './business-schema.js';

export const DB_NAMES = ['sales', 'catalog', 'hr'] as const;
export type DbName = (typeof DB_NAMES)[number];

export const DB_INFO: Record<DbName, { description: string; schema: string }> = {
  sales: {
    description: 'Ventes : clients, commandes, lignes de commande, paiements, expéditions, retours, avis, contacts',
    schema: SALES_SCHEMA,
  },
  catalog: { description: 'Catalogue : produits, catégories, fournisseurs', schema: CATALOG_SCHEMA },
  hr: { description: 'Ressources humaines : employés, départements', schema: HR_SCHEMA },
};

export const dbFile = (name: DbName): string => path.join(config.BUSINESS_DB_DIR, `${name}.db`);

const rw = new Map<DbName, Database.Database>();
const ro = new Map<DbName, Database.Database>();

/** Connexion en écriture (migrations et seed uniquement). */
export function getBusinessDb(name: DbName): Database.Database {
  let db = rw.get(name);
  if (!db) {
    fs.mkdirSync(config.BUSINESS_DB_DIR, { recursive: true });
    db = new Database(dbFile(name));
    db.pragma('foreign_keys = ON');
    rw.set(name, db);
  }
  return db;
}

/** Connexion en lecture seule, réservée à l'outil SQL. */
export function getBusinessReadonly(name: DbName): Database.Database {
  let db = ro.get(name);
  if (!db) {
    db = new Database(dbFile(name), { readonly: true, fileMustExist: true });
    db.pragma('query_only = ON');
    ro.set(name, db);
  }
  return db;
}

export function migrateBusiness(): void {
  for (const name of DB_NAMES) getBusinessDb(name).exec(DB_INFO[name].schema);
}
