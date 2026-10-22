import { migrate } from '../src/db/index.js';
import { migrateBusiness } from '../src/db/business.js';

migrate();
migrateBusiness();
console.log('Migrations terminées (base applicative + 3 bases métier).');
