import { config } from '../config/index.js';
import { HttpError } from '../errors.js';

export class OllamaError extends HttpError {}

export interface ToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_name?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: { name: string; description: string; parameters: object };
}

async function request<T>(path: string, body?: unknown, timeoutMs = config.LLM_TIMEOUT_MS): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.OLLAMA_URL}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw new OllamaError(504, `Timeout Ollama après ${timeoutMs} ms`);
    }
    throw new OllamaError(502, `Ollama injoignable à ${config.OLLAMA_URL} (est-il lancé ?)`);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new OllamaError(502, `Erreur Ollama ${res.status} : ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<ChatMessage> {
  const data = await request<{ message: ChatMessage }>('/api/chat', {
    model: config.CHAT_MODEL,
    messages,
    tools,
    stream: false,
  });
  return data.message;
}

export async function embed(texts: string[]): Promise<number[][]> {
  const data = await request<{ embeddings: number[][] }>('/api/embed', {
    model: config.EMBED_MODEL,
    input: texts,
  });
  return data.embeddings;
}

export async function ping(): Promise<boolean> {
  try {
    await request('/api/tags', undefined, 3000);
    return true;
  } catch {
    return false;
  }
}
