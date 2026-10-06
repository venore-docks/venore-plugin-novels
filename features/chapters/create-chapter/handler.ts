import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { createChapter } from "./service";
import type { CreateChapterInput, CreateChapterResult } from "./types";

export async function createChapterHandler(input: CreateChapterInput): Promise<CreateChapterResult> {
  if (!input.title.trim() || input.title.length > 160) {
    return { success: false, error: { code: "novels.invalid_title", message: "Informe o título do capítulo (até 160 caracteres)." } };
  }
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return createChapter({ ...input, actorId: authz.actorId });
}
