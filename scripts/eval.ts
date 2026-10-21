import { getDb, getReadonlyDb, migrate } from '../src/db/index.js';
import { extractNumbers } from '../src/verify/numbers.js';

const API = process.env.API_URL ?? 'http://localhost:3000';
const user = process.env.EVAL_USER ?? 'admin';
const password = process.env.EVAL_PASSWORD;
if (!password) {
  console.error('Définir EVAL_PASSWORD (compte admin)');
  process.exit(1);
}

migrate();
getDb();
const db = getReadonlyDb();
const one = (sql: string) => Object.values(db.prepare(sql).get() as Record<string, number>)[0] as number;

const cases = [
  { question: 'Combien de clients avons-nous au total ?', expected: one('SELECT COUNT(*) FROM customers') },
  { question: 'Combien de commandes ont le statut delivered ?', expected: one(`SELECT COUNT(*) FROM orders WHERE status = 'delivered'`) },
  { question: "Quel est le chiffre d'affaires total des commandes dont le statut est paid, shipped ou delivered ?", expected: one(`SELECT ROUND(SUM(total), 2) FROM orders WHERE status IN ('paid','shipped','delivered')`) },
  { question: 'Quel est le prix du produit Clavier mécanique K1 ?', expected: one(`SELECT price FROM products WHERE name = 'Clavier mécanique K1'`) },
  { question: 'Combien de produits sont en rupture de stock ?', expected: one('SELECT COUNT(*) FROM products WHERE stock = 0') },
  { question: 'Quel est le délai de retour prévu par les conditions générales de vente ? (en jours)', expected: 30 },
];

async function post(path: string, body: unknown, token?: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return (await res.json()) as Record<string, any>;
}

const login = await post('/auth/login', { name: user, password });
const token = login.token as string | undefined;
if (!token) {
  console.error('Login impossible :', login);
  process.exit(1);
}

let pass = 0;
for (const c of cases) {
  const r = await post('/chat', { message: c.question }, token);
  const numbers = extractNumbers(String(r.answer ?? ''));
  const ok = numbers.some((n) => Math.abs(n - c.expected) < 0.01);
  if (ok) pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'} attendu=${c.expected} verif=${r.verification?.status} outils=${r.toolsUsed} | ${c.question}`);
}
console.log(`\n${pass}/${cases.length} réponses correctes`);
process.exit(pass === cases.length ? 0 : 1);
