import type { PluginContributions } from "@venore/plugin-sdk";
import { novelsBreadcrumbSegments } from "./breadcrumbs";
import { blockDefinitions } from "./blocks/definitions";
import { novelsSeeds } from "./seeds";

// Tudo que sobe até handler/service (e daí ao SDK) entra por import dinâmico: um import estático
// fecharia um ciclo com contributions.generated.ts do core e o build de produção quebra com TDZ.
export const novelsContributions: PluginContributions = {
  breadcrumbSegments: novelsBreadcrumbSegments,
  mediaUsageResolver: async (mediaId) =>
    (await import("./features/media-usage/find-novels-media-usage/service")).findNovelsMediaUsage(mediaId),
  seeds: novelsSeeds,
  blockDefinitions,
  blockRenderers: async () => (await import("./blocks/renderers")).blockRenderers,
};
