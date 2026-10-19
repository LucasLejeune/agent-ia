import Fastify from 'fastify';
import { z, ZodError } from 'zod';
import { runChat } from '../agent/orchestrator.js';
import { dbIsUp } from '../db/index.js';
import { deleteSession, listIndexedDocuments } from '../db/repo.js';
import { HttpError } from '../errors.js';
import { ping } from '../llm/ollama.js';
import { logger } from '../logger.js';
import { ingestPath } from '../rag/ingest.js';

const ChatBody = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().uuid().optional(),
});
const IngestBody = z.object({ path: z.string().default('.') }).default({});

export function buildServer() {
  const app = Fastify({ loggerInstance: logger });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: 'Requête invalide', details: err.issues });
    }
    if (err instanceof HttpError) {
      req.log.warn({ err }, err.message);
      return reply.code(err.status).send({ error: err.message });
    }
    req.log.error({ err }, 'Erreur interne');
    return reply.code(500).send({ error: 'Erreur interne' });
  });

  app.get('/health', async (_req, reply) => {
    const db = dbIsUp();
    const ollama = await ping();
    const ok = db && ollama;
    return reply.code(ok ? 200 : 503).send({ ok, db, ollama });
  });

  app.post('/chat', async (req) => {
    const body = ChatBody.parse(req.body);
    return runChat(body.message, body.sessionId);
  });

  app.post('/ingest', async (req) => {
    const body = IngestBody.parse(req.body ?? {});
    return ingestPath(body.path);
  });

  app.get('/documents', async () => ({ documents: listIndexedDocuments() }));

  app.delete('/sessions/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!deleteSession(id)) throw new HttpError(404, `Session inconnue : ${id}`);
    return reply.code(204).send();
  });

  return app;
}
