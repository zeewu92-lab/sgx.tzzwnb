import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import 'dotenv/config';
import { testDatabaseConnection } from './db/client.js';
import { authRoutes } from './routes/auth.js';
import { syncRoutes } from './routes/sync.js';

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
});

await app.register(cookie);

await app.register(authRoutes);
await app.register(syncRoutes);

app.get('/api/health', async () => {
  const database = await testDatabaseConnection();

  return {
    ok: true,
    service: 'timezzw-server',
    database: 'connected',
    timestamp: database.now
  };
});

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

try {
  await app.listen({
    port: PORT,
    host: HOST
  });

  console.log(`時光線 API 已啟動：http://${HOST}:${PORT}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
