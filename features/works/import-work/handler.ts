import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { importWork } from "./service";
import type { ImportWorkInput, ImportWorkResult } from "./types";
import { validateImportWorkInput } from "./validation";

export async function importWorkHandler(input: ImportWorkInput): Promise<ImportWorkResult> {
  const validationError = validateImportWorkInput(input);
  if (validationError) return { success: false, error: validationError };

  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };

  return importWork({ ...input, actorId: authz.actorId });
}
