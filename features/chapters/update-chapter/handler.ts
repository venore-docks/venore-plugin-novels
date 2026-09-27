import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { updateChapter } from "./service";
import type { UpdateChapterInput, UpdateChapterResult } from "./types";

export async function updateChapterHandler(input: UpdateChapterInput): Promise<UpdateChapterResult> {
  if (Object.values(input.title).some((value) => value.length > 160)) {
    return { success: false, error: { code: "graphic-novels.invalid_title", message: "Título de capítulo com até 160 caracteres." } };
  }
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return updateChapter({ ...input, actorId: authz.actorId });
}
