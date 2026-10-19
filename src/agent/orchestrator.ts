import { randomUUID } from 'node:crypto';
import { config } from '../config/index.js';
import { addMessage, createSession, getHistory, sessionExists } from '../db/repo.js';
import { HttpError } from '../errors.js';
import { chat, type ChatMessage } from '../llm/ollama.js';
import { logger } from '../logger.js';
import { retrieve } from '../rag/retriever.js';
import { registry } from '../tools/index.js';

const SYSTEM_PROMPT = `Tu es un assistant en français. Tu disposes d'outils : calcul, liste/lecture de fichiers du corpus, requêtes SQL SELECT sur la table contacts.
Utilise un outil dès qu'il est nécessaire (n'invente jamais un calcul ou une donnée).
Si des extraits de documents sont fournis, appuie-toi dessus et cite le nom du fichier. Si tu ne sais pas, dis-le.`;

export interface ChatResult {
  sessionId: string;
  answer: string;
  toolsUsed: string[];
  sources: { path: string; score: number }[];
}

const stripThink = (s: string) => s.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

export async function runChat(message: string, sessionId?: string): Promise<ChatResult> {
  let id = sessionId;
  if (id) {
    if (!sessionExists(id)) throw new HttpError(404, `Session inconnue : ${id}`);
  } else {
    id = randomUUID();
    createSession(id);
  }

  const sources = await retrieve(message);
  const context = sources.length
    ? '\n\nExtraits documentaires :\n' + sources.map((s, i) => `[${i + 1}] (${s.path})\n${s.content}`).join('\n\n')
    : '';

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT + context },
    ...getHistory(id),
    { role: 'user', content: message },
  ];

  const toolsUsed: string[] = [];
  let answer = '';

  for (let i = 0; i <= config.MAX_TOOL_ITERATIONS; i++) {
    const reply = await chat(messages, registry.definitions());
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
      const content = await registry.execute(name, args);
      messages.push({ role: 'tool', tool_name: name, content });
    }
  }

  const uniqueTools = [...new Set(toolsUsed)];
  addMessage(id, 'user', message);
  addMessage(id, 'assistant', answer, uniqueTools);

  return {
    sessionId: id,
    answer,
    toolsUsed: uniqueTools,
    sources: sources.map((s) => ({ path: s.path, score: Number(s.score.toFixed(3)) })),
  };
}
