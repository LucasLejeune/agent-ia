import { buildServer } from './api/server.js';
import { config } from './config/index.js';
import { migrate } from './db/index.js';
import { migrateBusiness } from './db/business.js';

migrate();
migrateBusiness();
const app = buildServer();

app.listen({ port: config.PORT, host: '127.0.0.1' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
