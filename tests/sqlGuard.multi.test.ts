import { describe, expect, it } from 'vitest';
import { validateSelect } from '../src/tools/sqlGuard.js';

const admin = ['customers', 'orders', 'order_items', 'products', 'payments'];
const user = ['products', 'categories'];

describe('validateSelect multi-tables', () => {
  it('accepte une jointure sur tables autorisées', () => {
    const sql = `SELECT c.name, SUM(o.total) AS ca FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id`;
    expect(validateSelect(sql, admin)).toContain('JOIN orders');
  });
  it('refuse une table admin pour un utilisateur simple', () => {
    expect(() => validateSelect('SELECT * FROM customers', user)).toThrow();
    expect(() => validateSelect('SELECT p.name FROM products p JOIN orders o ON o.id = p.id', user)).toThrow();
  });
  it('refuse les tables internes', () => {
    for (const t of ['users', 'auth_tokens', 'sessions', 'messages', 'documents', 'chunks', 'sqlite_master']) {
      expect(() => validateSelect(`SELECT * FROM ${t}`, admin)).toThrow();
    }
  });
});
