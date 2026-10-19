import { getDb, migrate } from '../src/db/index.js';

migrate();
const db = getDb();
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

db.transaction(() => {
  db.prepare('DELETE FROM contacts').run();
  const insert = db.prepare('INSERT INTO contacts (name, email, city, company) VALUES (?, ?, ?, ?)');
  for (const c of contacts) insert.run(...c);
})();
console.log(`${contacts.length} contacts insérés.`);
