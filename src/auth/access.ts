import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getDb } from '../db/index.js';
import { hashPassword, verifyPassword } from './password.js';

const TOKEN_TTL_MS = 8 * 3600 * 1000;
const DUMMY_HASH = hashPassword('mot-de-passe-factice');

export function createUser(name: string, role: Role, password: string): AuthUser {
    const user = { id: randomUUID(), name, role };
    getDb().prepare('INSERT INTO users (id, name, role, password_hash) VALUES (?, ?, ?, ?)')
        .run(user.id, name, role, hashPassword(password));
    return user;
}

export function authenticate(name: string, password: string): AuthUser | undefined {
    const row = getDb().prepare('SELECT id, name, role, password_hash FROM users WHERE name = ?')
        .get(name) as (AuthUser & { password_hash: string }) | undefined;
    const ok = verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
    return row && ok ? { id: row.id, name: row.name, role: row.role } : undefined;
}

export function createToken(userId: string): { token: string; expiresAt: string } {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
    getDb().prepare('DELETE FROM auth_tokens WHERE expires_at < ?').run(new Date().toISOString());
    getDb().prepare('INSERT INTO auth_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
        .run(hashKey(token), userId, expiresAt);
    return { token, expiresAt };
}

export function findUserByToken(token: string): AuthUser | undefined {
    return getDb().prepare(
        `SELECT u.id, u.name, u.role FROM auth_tokens t JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ? AND t.expires_at > ?`,
    ).get(hashKey(token), new Date().toISOString()) as AuthUser | undefined;
}

export function revokeToken(token: string): void {
    getDb().prepare('DELETE FROM auth_tokens WHERE token_hash = ?').run(hashKey(token));
}

export type Role = 'admin' | 'user';
export interface AuthUser { id: string; name: string; role: Role }

export const hashKey = (k: string) => createHash('sha256').update(k).digest('hex');

export function grant(userId: string, docPath: string): boolean {
    return getDb().prepare(
        `INSERT OR IGNORE INTO document_access (document_id, user_id)
     SELECT id, ? FROM documents WHERE path = ?`).run(userId, docPath).changes > 0;
}

export function revoke(userId: string, docPath: string): boolean {
    return getDb().prepare(
        `DELETE FROM document_access WHERE user_id = ?
     AND document_id = (SELECT id FROM documents WHERE path = ?)`).run(userId, docPath).changes > 0;
}

export function accessibleDocuments(user: AuthUser): string[] {
    const db = getDb();
    const rows = (user.role === 'admin'
        ? db.prepare('SELECT path FROM documents ORDER BY path').all()
        : db.prepare(`SELECT d.path FROM documents d
                  JOIN document_access a ON a.document_id = d.id
                  WHERE a.user_id = ? ORDER BY d.path`).all(user.id)) as { path: string }[];
    return rows.map((r) => r.path);
}

export function canReadDocument(user: AuthUser, docPath: string): boolean {
    return accessibleDocuments(user).includes(docPath);
}