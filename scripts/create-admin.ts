import { createUser } from '../src/auth/access.js';
import { migrate } from '../src/db/index.js';

const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 8) {
    console.error('Définir ADMIN_PASSWORD (8 caractères minimum)');
    process.exit(1);
}
migrate();
const user = createUser(process.argv[2] ?? 'admin', 'admin', password);
console.log(`Admin créé : ${user.name}`);