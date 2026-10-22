import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineTool, ToolRegistry, type ToolGroup } from '../src/tools/registry.js';

const user = { id: 'u1', name: 'alice', role: 'user' as const };
const reg = new ToolRegistry()
  .register(defineTool({ name: 'sql_query', group: 'sql', description: 'd', parameters: {}, schema: z.object({}), run: () => ({ ok: 1 }) }))
  .register(defineTool({ name: 'web_search', group: 'web', description: 'd', parameters: {}, schema: z.object({}), run: () => ({ ok: 2 }) }));

describe('ToolRegistry + groupes', () => {
  it("n'expose que les groupes demandés", () => {
    const names = reg.definitions(user, new Set<ToolGroup>(['web'])).map((t) => t.function.name);
    expect(names).toEqual(['web_search']);
  });
  it('expose tout sans filtre', () => {
    expect(reg.definitions(user)).toHaveLength(2);
  });
  it('aucun outil si le routeur répond []', () => {
    expect(reg.definitions(user, new Set<ToolGroup>())).toEqual([]);
  });
  it("refuse l'exécution d'un outil hors groupes", async () => {
    const out = await reg.execute('sql_query', {}, { user, groups: new Set<ToolGroup>(['web']) });
    expect(out).toContain('non nécessaire');
  });
  it("exécute un outil autorisé", async () => {
    expect(await reg.execute('web_search', {}, { user, groups: new Set<ToolGroup>(['web']) })).toBe('{"ok":2}');
  });
});
