import { config } from '../src/config/index.js';
import { getBusinessReadonly, migrateBusiness, type DbName } from '../src/db/business.js';
import { extractNumbers } from '../src/verify/numbers.js';

const API = process.env.API_URL ?? 'http://localhost:3000';
const user = process.env.EVAL_USER ?? 'admin';
const password = process.env.EVAL_PASSWORD;
if (!password) {
  console.error('Définir EVAL_PASSWORD (compte admin)');
  process.exit(1);
}

migrateBusiness();
const one = (db: DbName, sql: string) =>
  Object.values(getBusinessReadonly(db).prepare(sql).get() as Record<string, number>)[0] as number;

type Reply = {
  answer?: string;
  toolsUsed?: string[];
  route?: { intents: string[] };
  verification?: { status: string };
};
interface Case {
  question: string;
  expected?: number;
  check?: (r: Reply) => boolean;
  label: string;
}

const k1 = one('catalog', `SELECT id FROM products WHERE name = 'Clavier mécanique K1'`);
const cases: Case[] = [
  { label: 'SQL sales', question: 'Combien de clients avons-nous au total ?', expected: one('sales', 'SELECT COUNT(*) FROM customers') },
  { label: 'SQL sales', question: "Quel est le chiffre d'affaires total des commandes dont le statut est paid, shipped ou delivered ?", expected: one('sales', `SELECT ROUND(SUM(total), 2) FROM orders WHERE status IN ('paid','shipped','delivered')`) },
  { label: 'SQL catalog', question: 'Quel est le prix du produit Clavier mécanique K1 ?', expected: one('catalog', `SELECT price FROM products WHERE id = ${k1}`) },
  { label: 'SQL catalog', question: 'Combien de produits sont en rupture de stock ?', expected: one('catalog', 'SELECT COUNT(*) FROM products WHERE stock = 0') },
  { label: 'SQL hr', question: "Combien d'employés travaillent dans le département Ventes ?", expected: one('hr', `SELECT COUNT(*) FROM employees e JOIN departments d ON d.id = e.department_id WHERE d.name = 'Ventes'`) },
  { label: 'Inter-bases', question: 'Dans combien de commandes distinctes le produit Clavier mécanique K1 apparaît-il ?', expected: one('sales', `SELECT COUNT(DISTINCT order_id) FROM order_items WHERE product_id = ${k1}`) },
  { label: 'Documents', question: 'Quel est le délai de retour (en jours) prévu par les conditions générales de vente ?', expected: 30 },
  { label: 'Sans outil', question: 'Quelle est la capitale de la France ?', check: (r) => (r.toolsUsed ?? []).length === 0 && /paris/i.test(r.answer ?? '') },
  { label: 'Sans outil', question: 'Bonjour !', check: (r) => (r.toolsUsed ?? []).length === 0 },
  { label: 'Calcul', question: 'Combien font 123*45+7 ?', expected: 5542, check: (r) => (r.toolsUsed ?? []).every((t) => t === 'calculator') },
];
if (config.WEB_SEARCH_PROVIDER !== 'none') {
  cases.push({
    label: 'Web (pas de SQL)',
    question: "Quel temps fait-il aujourd'hui à Lille ?",
    check: (r) => (r.toolsUsed ?? []).includes('web_search') && !(r.toolsUsed ?? []).some((t) => t.includes('sql') || t === 'describe_schema'),
  });
}

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
  const r = (await post('/chat', { message: c.question }, token)) as Reply;
  const numOk = c.expected === undefined || extractNumbers(r.answer ?? '').some((n) => Math.abs(n - (c.expected as number)) < 0.01);
  const checkOk = c.check ? c.check(r) : true;
  const ok = numOk && checkOk;
  if (ok) pass++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'} [${c.label}] outils=[${r.toolsUsed ?? ''}] route=[${r.route?.intents ?? ''}] verif=${r.verification?.status} | ${c.question}`,
  );
}
console.log(`\n${pass}/${cases.length} cas OK`);
process.exit(pass === cases.length ? 0 : 1);
