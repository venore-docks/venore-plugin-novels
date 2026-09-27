import type { PluginSeedFn } from "@venore/plugin-sdk";

// Import dinâmico pelo mesmo motivo de breadcrumbs.ts: o seed sobe até service -> SDK, e este
// arquivo entra no grafo de contributions.generated.ts do core.
export const graphicNovelsSeeds: Record<string, PluginSeedFn> = {
  example: async () => (await import("./example")).seedGraphicNovelsExample(),
};
