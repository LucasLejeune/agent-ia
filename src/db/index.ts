import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { SCHEMA } from './schema.js';

let rw: Database.Database | undefined;
let ro: Database.Database | undefined;

export function getDb(): Database.Database {
  if (!rw) {
    fs.mkdirSync(path.dirname(config.DB_PATH), { recursive: true });
    rw = new Database(config.DB_PATH);
    rw.pragma('journal_mode = WAL');
    rw.pragma('foreign_keys = ON');
  }
  return rw;
}

export function migrate(): void {
  getDb().exec(SCHEMA);
}

/** Connexion en lecture seule, réservée à l'outil SQL. */
export function getReadonlyDb(): Database.Database {
  if (!ro) {
    ro = new Database(config.DB_PATH, { readonly: true, fileMustExist: true });
    ro.pragma('query_only = ON');
  }
  return ro;
}

export function dbIsUp(): boolean {
  try {
    getDb().prepare('SELECT 1').get();
    return true;
  } catch {
    return false;
  }
}
