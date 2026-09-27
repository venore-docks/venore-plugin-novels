import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { deleteChapter } from "./service";
import type { DeleteChapterInput, DeleteChapterResult } from "./types";

export async function deleteChapterHandler(input: DeleteChapterInput): Promise<DeleteChapterResult> {
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return deleteChapter({ ...input, actorId: authz.actorId });
}
