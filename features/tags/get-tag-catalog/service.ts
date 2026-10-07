import { countWorksPerTag, findTagCatalog } from "./store";
import type { GetTagCatalogResult } from "./types";

export async function getTagCatalog(): Promise<GetTagCatalogResult> {
  const [catalog, usage] = await Promise.all([findTagCatalog(), countWorksPerTag()]);
  return { success: true, data: { ...catalog, usage } };
}
