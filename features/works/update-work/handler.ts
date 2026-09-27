import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { updateWork } from "./service";
import type { UpdateWorkInput, UpdateWorkResult } from "./types";
import { validateUpdateWorkInput } from "./validation";

export async function updateWorkHandler(input: UpdateWorkInput): Promise<UpdateWorkResult> {
  const validationError = validateUpdateWorkInput(input);
  if (validationError) return { success: false, error: validationError };

  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };

  return updateWork({ ...input, actorId: authz.actorId });
}
