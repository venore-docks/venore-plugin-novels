import type { BlockRendererComponent } from "@venore/plugin-sdk";
import { WorkListBlock } from "./work-list-block";

export const blockRenderers: Record<string, BlockRendererComponent> = {
  "graphic-novels.work.list": WorkListBlock,
};
