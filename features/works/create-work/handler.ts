import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { createWork } from "./service";
import type { CreateWorkInput, CreateWorkResult } from "./types";
import { validateCreateWorkInput } from "./validation";

export async function createWorkHandler(input: CreateWorkInput): Promise<CreateWorkResult> {
  const validationError = validateCreateWorkInput(input);
  if (validationError) return { success: false, error: validationError };

  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };

  return createWork({ ...input, title: input.title.trim(), actorId: authz.actorId });
}
