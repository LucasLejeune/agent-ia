import { z } from 'zod';
import type { AuthUser } from '../auth/access.js';
import type { DbName } from '../db/business.js';
import type { ToolDefinition } from '../llm/ollama.js';

export type ToolGroup = 'sql' | 'documents' | 'web' | 'calc';

export interface ToolContext {
  user: AuthUser;
  /** Groupes d'outils autorisés pour CETTE question (décidés par le routeur). */
  groups?: ReadonlySet<ToolGroup>;
  /** Bases SQL autorisées pour CETTE question. */
  databases?: readonly DbName[];
}

export interface Tool {
  name: string;
  group: ToolGroup;
  description: string;
  parameters: object;
  adminOnly: boolean;
  execute(raw: unknown, ctx: ToolContext): Promise<unknown>;
}

export function defineTool<S extends z.ZodTypeAny>(d: {
  name: string;
  group: ToolGroup;
  description: string;
  parameters: object;
  schema: S;
  adminOnly?: boolean;
  run: (args: z.infer<S>, ctx: ToolContext) => unknown | Promise<unknown>;
}): Tool {
  return {
    name: d.name,
    group: d.group,
    description: d.description,
    parameters: d.parameters,
    adminOnly: d.adminOnly ?? false,
    execute: async (raw, ctx) => d.run(d.schema.parse(raw), ctx),
  };
}

const MAX_RESULT_CHARS = 8000;

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  /** Outils exposés au modèle : filtrés par rôle ET par groupes décidés par le routeur. */
  definitions(user: AuthUser, groups?: ReadonlySet<ToolGroup>): ToolDefinition[] {
    return [...this.tools.values()]
      .filter((t) => !t.adminOnly || user.role === 'admin')
      .filter((t) => !groups || groups.has(t.group))
      .map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
  }

  async execute(name: string, args: unknown, ctx: ToolContext): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) return JSON.stringify({ error: `Outil inconnu : ${name}` });
    if (tool.adminOnly && ctx.user.role !== 'admin') {
      return JSON.stringify({ error: 'Outil réservé aux administrateurs' });
    }
    if (ctx.groups && !ctx.groups.has(tool.group)) {
      return JSON.stringify({ error: `Outil non nécessaire pour cette question : ${name}` });
    }
    try {
      return JSON.stringify(await tool.execute(args, ctx)).slice(0, MAX_RESULT_CHARS);
    } catch (e) {
      return JSON.stringify({ error: e instanceof Error ? e.message : 'Erreur outil' });
    }
  }
}
