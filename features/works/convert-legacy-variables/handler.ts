import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { convertLegacyVariables } from "./service";
import type { ConvertLegacyVariablesInput, ConvertLegacyVariablesResult } from "./types";

export async function convertLegacyVariablesHandler(input: ConvertLegacyVariablesInput): Promise<ConvertLegacyVariablesResult> {
  if (typeof input.workId !== "string" || !input.workId) return { success: false, error: { code: "novels.invalid_work", message: "Obra não informada." } };
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return convertLegacyVariables({ ...input, actorId: authz.actorId });
}
