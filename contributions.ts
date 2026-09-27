import type { PluginContributions } from "@venore/plugin-sdk";
import { graphicNovelsBreadcrumbSegments } from "./breadcrumbs";
import { blockDefinitions } from "./blocks/definitions";
import { graphicNovelsSeeds } from "./seeds";

// Tudo que sobe até handler/service (e daí ao SDK) entra por import dinâmico: um import estático
// fecharia um ciclo com contributions.generated.ts do core e o build de produção quebra com TDZ.
export const graphicNovelsContributions: PluginContributions = {
  breadcrumbSegments: graphicNovelsBreadcrumbSegments,
  mediaUsageResolver: async (mediaId) =>
    (await import("./features/media-usage/find-graphic-novels-media-usage/service")).findGraphicNovelsMediaUsage(mediaId),
  seeds: graphicNovelsSeeds,
  blockDefinitions,
  blockRenderers: async () => (await import("./blocks/renderers")).blockRenderers,
};
