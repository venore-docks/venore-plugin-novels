import type { PluginSeedFn } from "@venore/plugin-sdk";
import { seedGraphicNovelsExample } from "./example";

export const graphicNovelsSeeds: Record<string, PluginSeedFn> = {
  example: seedGraphicNovelsExample,
};
