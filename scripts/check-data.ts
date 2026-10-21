import { getDb, getReadonlyDb, migrate } from '../src/db/index.js';

migrate();
getDb();
const db = getReadonlyDb();

const checks: [string, string][] = [
  ['Total commande = somme des lignes', `SELECT o.id FROM orders o JOIN order_items i ON i.order_id = o.id GROUP BY o.id HAVING ABS(o.total - SUM(i.quantity * i.unit_price)) > 0.01`],
  ['Commande sans ligne', `SELECT id FROM orders WHERE id NOT IN (SELECT order_id FROM order_items)`],
  ['Paiement = total de la commande', `SELECT p.id FROM payments p JOIN orders o ON o.id = p.order_id WHERE ABS(p.amount - o.total) > 0.01`],
  ['Paiement sur commande annulée/en attente', `SELECT p.id FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.status IN ('pending','cancelled')`],
  ['Livraison sur commande non expédiée', `SELECT s.id FROM shipments s JOIN orders o ON o.id = s.order_id WHERE o.status NOT IN ('shipped','delivered')`],
  ['Remboursement > total', `SELECT r.id FROM returns r JOIN orders o ON o.id = r.order_id WHERE r.refunded_amount > o.total`],
  ['Clés étrangères invalides', `PRAGMA foreign_key_check`],
];

let failures = 0;
for (const [label, sql] of checks) {
  const bad = db.prepare(sql).all();
  console.log(`${bad.length === 0 ? 'OK  ' : 'FAIL'} ${label}${bad.length ? ` (${bad.length})` : ''}`);
  if (bad.length) failures++;
}

const tables = db
  .prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
  .get() as { n: number };
console.log(`Tables en base : ${tables.n}`);
process.exit(failures ? 1 : 0);
