import Fastify from 'fastify';
import { z, ZodError } from 'zod';
import { runChat } from '../agent/orchestrator.js';
import {
  accessibleDocuments,
  authenticate,
  createToken,
  createUser,
  findUserByToken,
  grant,
  revoke,
  revokeToken,
  type AuthUser,
} from '../auth/access.js';
import { dbIsUp } from '../db/index.js';
import { deleteSession, listIndexedDocuments } from '../db/repo.js';
import { HttpError } from '../errors.js';
import { ping } from '../llm/ollama.js';
import { logger } from '../logger.js';
import { ingestPath } from '../rag/ingest.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
    token?: string;
  }
}

const ChatBody = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().uuid().optional(),
});
const IngestBody = z.object({ path: z.string().default('.') }).default({});
const LoginBody = z.object({ name: z.string().min(1), password: z.string().min(1) });
const CreateUserBody = z.object({
  name: z.string().min(1),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum'),
  role: z.enum(['admin', 'user']).default('user'),
});
const GrantBody = z.object({ userId: z.string().min(1), path: z.string().min(1) });

const requireUser = (req: { user?: AuthUser }): AuthUser => {
  if (!req.user) throw new HttpError(401, 'Non authentifié');
  return req.user;
};

const requireAdmin = (req: { user?: AuthUser }): AuthUser => {
  const u = requireUser(req);
  if (u.role !== 'admin') throw new HttpError(403, 'Réservé aux administrateurs');
  return u;
};

// Verrouillage anti force brute (en mémoire)
const attempts = new Map<string, { count: number; lockedUntil: number }>();
const checkLock = (key: string) => {
  const a = attempts.get(key);
  if (a && a.lockedUntil > Date.now()) {
    throw new HttpError(429, 'Trop de tentatives, réessayez plus tard');
  }
};
const recordFailure = (key: string) => {
  const a = attempts.get(key) ?? { count: 0, lockedUntil: 0 };
  a.count++;
  if (a.count >= 5) {
    a.lockedUntil = Date.now() + 15 * 60_000;
    a.count = 0;
  }
  attempts.set(key, a);
};

const PUBLIC_ROUTES = new Set(['/health', '/auth/login']);

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

  app.addHook('onRequest', async (req) => {
    if (PUBLIC_ROUTES.has(req.url.split('?')[0] ?? '')) return;
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new HttpError(401, 'Token manquant (Authorization: Bearer ...)');
    }
    const token = header.slice(7);
    const user = findUserByToken(token);
    if (!user) throw new HttpError(401, 'Token invalide ou expiré');
    req.user = user;
    req.token = token;
  });

  app.get('/health', async (_req, reply) => {
    const db = dbIsUp();
    const ollama = await ping();
    const ok = db && ollama;
    return reply.code(ok ? 200 : 503).send({ ok, db, ollama });
  });

  app.post('/auth/login', async (req) => {
    const { name, password } = LoginBody.parse(req.body);
    const key = `${req.ip}:${name}`;
    checkLock(key);
    const user = authenticate(name, password);
    if (!user) {
      recordFailure(key);
      throw new HttpError(401, 'Identifiants invalides');
    }
    attempts.delete(key);
    return { ...createToken(user.id), user };
  });

  app.post('/auth/logout', async (req, reply) => {
    requireUser(req);
    revokeToken(req.token as string);
    return reply.code(204).send();
  });

  app.get('/auth/me', async (req) => requireUser(req));

  app.post('/chat', async (req) => {
    const body = ChatBody.parse(req.body);
    return runChat(body.message, requireUser(req), body.sessionId);
  });

  app.post('/ingest', async (req) => {
    requireAdmin(req);
    const body = IngestBody.parse(req.body ?? {});
    return ingestPath(body.path);
  });

  app.get('/documents', async (req) => {
    const allowed = new Set(accessibleDocuments(requireUser(req)));
    return { documents: listIndexedDocuments().filter((d) => allowed.has(d.path)) };
  });

  app.delete('/sessions/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!deleteSession(id, requireUser(req).id)) {
      throw new HttpError(404, `Session inconnue : ${id}`);
    }
    return reply.code(204).send();
  });

  app.post('/admin/users', async (req, reply) => {
    requireAdmin(req);
    const { name, password, role } = CreateUserBody.parse(req.body);
    return reply.code(201).send(createUser(name, role, password));
  });

  app.post('/admin/grants', async (req) => {
    requireAdmin(req);
    const { userId, path } = GrantBody.parse(req.body);
    if (!grant(userId, path)) {
      throw new HttpError(404, 'Document non indexé ou droit déjà accordé');
    }
    return { ok: true };
  });

  app.post('/admin/revocations', async (req) => {
    requireAdmin(req);
    const { userId, path } = GrantBody.parse(req.body);
    return { ok: revoke(userId, path) };
  });

  return app;
}