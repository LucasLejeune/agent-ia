import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password.js';

describe('password', () => {
    it('valide le bon mot de passe', () => expect(verifyPassword('abc12345', hashPassword('abc12345'))).toBe(true));
    it('refuse un mauvais mot de passe', () => expect(verifyPassword('autre', hashPassword('abc12345'))).toBe(false));
    it('sale le hash', () => expect(hashPassword('x1234567')).not.toBe(hashPassword('x1234567')));
    it('refuse un hash malformé', () => expect(verifyPassword('a', 'nimporte')).toBe(false));
});