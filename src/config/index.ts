import 'dotenv/config';
import { z } from 'zod';

const bool = (d: 'true' | 'false') =>
  z.enum(['true', 'false']).default(d).transform((v) => v === 'true');

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),
  CHAT_MODEL: z.string().min(1).default('qwen3:8b'),
  EMBED_MODEL: z.string().min(1).default('nomic-embed-text'),
  DB_PATH: z.string().default('./data/agent.db'),
  BUSINESS_DB_DIR: z.string().default('./data/business'),
  CORPUS_DIR: z.string().default('./documents'),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  MAX_TOOL_ITERATIONS: z.coerce.number().int().min(1).default(6),
  RAG_TOP_K: z.coerce.number().int().min(1).default(4),
  RAG_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.35),
  CHUNK_SIZE: z.coerce.number().int().min(100).default(800),
  CHUNK_OVERLAP: z.coerce.number().int().min(0).default(100),
  VERIFY_ANSWERS: bool('true'),
  ROUTER_ENABLED: bool('true'),
  WEB_SEARCH_PROVIDER: z.enum(['none', 'searxng', 'ollama']).default('none'),
  SEARXNG_URL: z.string().url().default('http://localhost:4000'),
  OLLAMA_API_KEY: z.string().optional(),
  WEB_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  WEB_MAX_RESULTS: z.coerce.number().int().min(1).max(10).default(5),
  LOG_LEVEL: z.string().default('info'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuration invalide :', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
if (parsed.data.CHUNK_OVERLAP >= parsed.data.CHUNK_SIZE) {
  console.error('CHUNK_OVERLAP doit être inférieur à CHUNK_SIZE');
  process.exit(1);
}
if (parsed.data.WEB_SEARCH_PROVIDER === 'ollama' && !parsed.data.OLLAMA_API_KEY) {
  console.error('WEB_SEARCH_PROVIDER=ollama nécessite OLLAMA_API_KEY');
  process.exit(1);
}

export const config = parsed.data;
