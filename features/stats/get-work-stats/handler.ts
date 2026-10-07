import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { getWorkStats } from "./service";
import type { GetWorkStatsInput, GetWorkStatsResult } from "./types";

export async function getWorkStatsHandler(input: GetWorkStatsInput): Promise<GetWorkStatsResult> {
  if (typeof input.workId !== "string" || !input.workId) return { success: false, error: { code: "novels.invalid_work", message: "Obra não informada." } };
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return getWorkStats(input);
}
