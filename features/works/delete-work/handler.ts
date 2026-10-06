import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { deleteWork } from "./service";
import type { DeleteWorkInput, DeleteWorkResult } from "./types";

export async function deleteWorkHandler(input: DeleteWorkInput): Promise<DeleteWorkResult> {
  if (!input.workId) return { success: false, error: { code: "novels.invalid_work", message: "Obra não informada." } };
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return deleteWork({ ...input, actorId: authz.actorId });
}
