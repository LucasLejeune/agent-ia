import fs from 'node:fs';
import { getBusinessDb, migrateBusiness, type DbName } from '../src/db/business.js';

migrateBusiness();

const contacts = [
  ['Alice Martin', 'alice.martin@example.com', 'Lille', 'Acme'],
  ['Bruno Lefevre', 'bruno.lefevre@example.com', 'Valenciennes', 'Globex'],
  ['Chloé Dubois', 'chloe.dubois@example.com', 'Paris', 'Initech'],
  ['David Petit', 'david.petit@example.com', 'Lille', 'Acme'],
  ['Emma Roux', 'emma.roux@example.com', 'Lyon', 'Umbrella'],
  ['Farid Benali', 'farid.benali@example.com', 'Marseille', 'Globex'],
  ['Inès Moreau', 'ines.moreau@example.com', 'Valenciennes', 'Initech'],
  ['Hugo Garnier', 'hugo.garnier@example.com', 'Paris', 'Acme'],
] as const;

const sales = getBusinessDb('sales');
sales.transaction(() => {
  sales.prepare('DELETE FROM contacts').run();
  const insert = sales.prepare('INSERT INTO contacts (name, email, city, company) VALUES (?, ?, ?, ?)');
  for (const c of contacts) insert.run(...c);
})();

for (const name of ['catalog', 'hr', 'sales'] as DbName[]) {
  getBusinessDb(name).exec(fs.readFileSync(new URL(`./seed-${name}.sql`, import.meta.url), 'utf8'));
}

const count = (db: DbName, t: string) =>
  (getBusinessDb(db).prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
console.log(
  `Seed OK. sales: ${count('sales', 'customers')} clients, ${count('sales', 'orders')} commandes, ${count('sales', 'order_items')} lignes | ` +
    `catalog: ${count('catalog', 'products')} produits | hr: ${count('hr', 'employees')} employés.`,
);
