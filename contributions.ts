import type { PluginContributions } from "@venore/plugin-sdk";
import { graphicNovelsBreadcrumbSegments } from "./breadcrumbs";
import { blockDefinitions } from "./blocks/definitions";
import { findGraphicNovelsMediaUsage } from "./features/media-usage/find-graphic-novels-media-usage/service";
import { graphicNovelsSeeds } from "./seeds";

// blockRenderers é preguiçoso (sobe até handler -> db), mesmo padrão dos outros plugins.
export const graphicNovelsContributions: PluginContributions = {
  breadcrumbSegments: graphicNovelsBreadcrumbSegments,
  mediaUsageResolver: findGraphicNovelsMediaUsage,
  seeds: graphicNovelsSeeds,
  blockDefinitions,
  blockRenderers: async () => (await import("./blocks/renderers")).blockRenderers,
};
