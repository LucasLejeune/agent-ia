import { describe, expect, it } from 'vitest';
import { validateSelect } from '../src/tools/sqlGuard.js';

const allowed = ['contacts'];

describe('validateSelect', () => {
  it('accepte un SELECT simple', () => {
    expect(validateSelect("SELECT * FROM contacts WHERE city = 'Lille';", allowed)).toContain('FROM contacts');
  });
  it.each([
    'DELETE FROM contacts',
    'DROP TABLE contacts',
    'SELECT * FROM users',
    'SELECT 1; DROP TABLE contacts',
    'SELECT * FROM contacts, users',
    'SELECT * FROM contacts WHERE id IN (SELECT id FROM sqlite_master)',
    'SELECT * FROM "users"',
    'SELECT * FROM contacts -- x',
    'UPDATE contacts SET name = 1',
    "SELECT * FROM contacts; ATTACH DATABASE 'x' AS y",
  ])('refuse : %s', (sql) => {
    expect(() => validateSelect(sql, allowed)).toThrow();
  });
});
