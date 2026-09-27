import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { listWorks } from "./service";
import type { ListWorksResult } from "./types";

export async function listWorksHandler(): Promise<ListWorksResult> {
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return listWorks();
}
