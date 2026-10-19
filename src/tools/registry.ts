import { z } from 'zod';
import type { ToolDefinition } from '../llm/ollama.js';

export interface Tool {
  name: string;
  description: string;
  parameters: object;
  execute(raw: unknown): Promise<unknown>;
}

export function defineTool<S extends z.ZodTypeAny>(d: {
  name: string;
  description: string;
  parameters: object;
  schema: S;
  run: (args: z.infer<S>) => unknown | Promise<unknown>;
}): Tool {
  return {
    name: d.name,
    description: d.description,
    parameters: d.parameters,
    execute: async (raw) => d.run(d.schema.parse(raw)),
  };
}

const MAX_RESULT_CHARS = 8000;

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  definitions(): ToolDefinition[] {
    return [...this.tools.values()].map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  /** Exécute un outil ; ne lève jamais : les erreurs sont renvoyées au modèle. */
  async execute(name: string, args: unknown): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) return JSON.stringify({ error: `Outil inconnu : ${name}` });
    try {
      const result = await tool.execute(args);
      return JSON.stringify(result).slice(0, MAX_RESULT_CHARS);
    } catch (e) {
      return JSON.stringify({ error: e instanceof Error ? e.message : 'Erreur outil' });
    }
  }
}
