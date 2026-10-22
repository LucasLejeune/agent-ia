import Database from 'better-sqlite3';
import { dbFile, DB_NAMES, migrateBusiness } from '../src/db/business.js';

migrateBusiness();

const db = new Database(dbFile('sales'), { readonly: true });
db.prepare('ATTACH DATABASE ? AS catalog').run(dbFile('catalog'));
db.prepare('ATTACH DATABASE ? AS hr').run(dbFile('hr'));

const checks: [string, string][] = [
  ['Total commande = somme des lignes', `SELECT o.id FROM orders o JOIN order_items i ON i.order_id = o.id GROUP BY o.id HAVING ABS(o.total - SUM(i.quantity * i.unit_price)) > 0.01`],
  ['Commande sans ligne', `SELECT id FROM orders WHERE id NOT IN (SELECT order_id FROM order_items)`],
  ['Paiement = total de la commande', `SELECT p.id FROM payments p JOIN orders o ON o.id = p.order_id WHERE ABS(p.amount - o.total) > 0.01`],
  ['Paiement sur commande annulée/en attente', `SELECT p.id FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.status IN ('pending','cancelled')`],
  ['Livraison sur commande non expédiée', `SELECT s.id FROM shipments s JOIN orders o ON o.id = s.order_id WHERE o.status NOT IN ('shipped','delivered')`],
  ['Remboursement > total', `SELECT r.id FROM returns r JOIN orders o ON o.id = r.order_id WHERE r.refunded_amount > o.total`],
  ['[inter-bases] order_items.product_id -> catalog.products', `SELECT i.id FROM order_items i WHERE i.product_id NOT IN (SELECT id FROM catalog.products)`],
  ['[inter-bases] reviews.product_id -> catalog.products', `SELECT id FROM reviews WHERE product_id NOT IN (SELECT id FROM catalog.products)`],
  ['[inter-bases] orders.employee_id -> hr.employees', `SELECT id FROM orders WHERE employee_id IS NOT NULL AND employee_id NOT IN (SELECT id FROM hr.employees)`],
  ['[inter-bases] prix de ligne = prix catalogue', `SELECT i.id FROM order_items i JOIN catalog.products p ON p.id = i.product_id WHERE ABS(i.unit_price - p.price) > 0.001`],
  ['Clés étrangères (sales)', `PRAGMA main.foreign_key_check`],
  ['Clés étrangères (catalog)', `PRAGMA catalog.foreign_key_check`],
  ['Clés étrangères (hr)', `PRAGMA hr.foreign_key_check`],
];

let failures = 0;
for (const [label, sql] of checks) {
  const bad = db.prepare(sql).all();
  console.log(`${bad.length === 0 ? 'OK  ' : 'FAIL'} ${label}${bad.length ? ` (${bad.length})` : ''}`);
  if (bad.length) failures++;
}

let tables = 0;
for (const name of DB_NAMES) {
  const schema = name === 'sales' ? 'main' : name;
  tables += (db.prepare(`SELECT COUNT(*) AS n FROM ${schema}.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).get() as { n: number }).n;
}
console.log(`Bases : ${DB_NAMES.length} | Tables métier : ${tables}`);
process.exit(failures ? 1 : 0);
