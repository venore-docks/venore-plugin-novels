import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { updateWorkVariables } from "./service";
import type { UpdateWorkVariablesInput, UpdateWorkVariablesResult } from "./types";
import { validateUpdateWorkVariablesInput } from "./validation";

export async function updateWorkVariablesHandler(input: UpdateWorkVariablesInput): Promise<UpdateWorkVariablesResult> {
  const error = validateUpdateWorkVariablesInput(input);
  if (error) return { success: false, error };
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return updateWorkVariables({ ...input, actorId: authz.actorId });
}
