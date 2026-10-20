import { z } from 'zod';
import type { AuthUser } from '../auth/access.js';
import type { ToolDefinition } from '../llm/ollama.js';

export interface ToolContext { user: AuthUser }

export interface Tool {
  name: string;
  description: string;
  parameters: object;
  adminOnly: boolean;
  execute(raw: unknown, ctx: ToolContext): Promise<unknown>;
}

export function defineTool<S extends z.ZodTypeAny>(d: {
  name: string; description: string; parameters: object; schema: S; adminOnly?: boolean;
  run: (args: z.infer<S>, ctx: ToolContext) => unknown | Promise<unknown>;
}): Tool {
  return {
    name: d.name, description: d.description, parameters: d.parameters,
    adminOnly: d.adminOnly ?? false,
    execute: async (raw, ctx) => d.run(d.schema.parse(raw), ctx),
  };
}

const MAX_RESULT_CHARS = 8000;

export class ToolRegistry {
  private tools = new Map<string, Tool>();
  register(tool: Tool): this { this.tools.set(tool.name, tool); return this; }

  definitions(user: AuthUser): ToolDefinition[] {
    return [...this.tools.values()]
      .filter((t) => !t.adminOnly || user.role === 'admin')
      .map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
  }

  async execute(name: string, args: unknown, ctx: ToolContext): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) return JSON.stringify({ error: `Outil inconnu : ${name}` });
    if (tool.adminOnly && ctx.user.role !== 'admin') return JSON.stringify({ error: 'Outil réservé aux administrateurs' });
    try {
      return JSON.stringify(await tool.execute(args, ctx)).slice(0, MAX_RESULT_CHARS);
    } catch (e) {
      return JSON.stringify({ error: e instanceof Error ? e.message : 'Erreur outil' });
    }
  }
}