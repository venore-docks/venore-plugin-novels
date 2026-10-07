import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { TAGS_PERMISSION } from "../../../shared/constants";
import { getTagCatalog } from "./service";
import type { GetTagCatalogResult } from "./types";

export async function getTagCatalogHandler(): Promise<GetTagCatalogResult> {
  const authz = await authorizeActor(TAGS_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return getTagCatalog();
}
