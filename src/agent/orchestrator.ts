import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../auth/access.js';
import { config } from '../config/index.js';
import { addMessage, createSession, getHistory, sessionOwnedBy } from '../db/repo.js';
import { HttpError } from '../errors.js';
import { chat, type ChatMessage } from '../llm/ollama.js';
import { logger } from '../logger.js';
import { retrieve } from '../rag/retriever.js';
import { registry } from '../tools/index.js';
import { verifyAnswer, type Verification } from '../verify/index.js';

const SYSTEM_PROMPT = `Tu es un assistant en français. Tu disposes d'outils :
- describe_schema puis sql_query pour toute question chiffrée sur la base de données (clients, commandes, produits...). Utilise les agrégats SQL (COUNT, SUM, AVG) au lieu de calculer toi-même.
- search_documents et read_file pour les documents (PDF, fiches, procédures, conditions).
- calculator pour l'arithmétique.
Règles de véracité :
- Ne donne JAMAIS un chiffre, une date ou une règle qui ne vient pas d'un outil ou d'un extrait fourni.
- Cite tes sources : (fichier, page) pour les documents, ou le nom des tables pour le SQL.
- Si l'information est introuvable ou si l'accès est refusé, dis-le clairement sans inventer.
- Si les documents et la base se contredisent, signale la contradiction.`;

export interface ChatResult {
  sessionId: string;
  answer: string;
  toolsUsed: string[];
  sources: { path: string; page: number | null; score: number }[];
  verification: Verification;
}

const stripThink = (s: string) => s.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

export async function runChat(message: string, user: AuthUser, sessionId?: string): Promise<ChatResult> {
  let id = sessionId;
  if (id) {
    if (!sessionOwnedBy(id, user.id)) throw new HttpError(404, `Session inconnue : ${id}`);
  } else {
    id = randomUUID();
    createSession(id, user.id);
  }

  const sources = await retrieve(message, user);
  const label = (s: { path: string; page: number | null }) => `${s.path}${s.page ? `, page ${s.page}` : ''}`;
  const context = sources.length
    ? '\n\nExtraits documentaires :\n' + sources.map((s, i) => `[${i + 1}] (${label(s)})\n${s.content}`).join('\n\n')
    : '';
  const evidence: string[] = sources.map((s) => `[${label(s)}] ${s.content}`);

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT + context },
    ...getHistory(id),
    { role: 'user', content: message },
  ];

  const toolsUsed: string[] = [];
  let answer = '';

  for (let i = 0; i <= config.MAX_TOOL_ITERATIONS; i++) {
    const reply = await chat(messages, registry.definitions(user));
    messages.push(reply);

    if (!reply.tool_calls?.length) {
      answer = stripThink(reply.content);
      break;
    }
    if (i === config.MAX_TOOL_ITERATIONS) {
      answer = "Limite d'itérations d'outils atteinte sans réponse finale.";
      break;
    }
    for (const call of reply.tool_calls) {
      const { name, arguments: args } = call.function;
      logger.info({ sessionId: id, tool: name, args }, 'tool call');
      toolsUsed.push(name);
      const content = await registry.execute(name, args, { user });
      evidence.push(`[outil ${name}] ${content}`);
      messages.push({ role: 'tool', tool_name: name, content });
    }
  }

  const verification = await verifyAnswer(message, answer, evidence);
  logger.info({ sessionId: id, verification }, 'verification');

  const uniqueTools = [...new Set(toolsUsed)];
  addMessage(id, 'user', message);
  addMessage(id, 'assistant', answer, uniqueTools);

  return {
    sessionId: id,
    answer,
    toolsUsed: uniqueTools,
    sources: sources.map((s) => ({ path: s.path, page: s.page, score: Number(s.score.toFixed(3)) })),
    verification,
  };
}
