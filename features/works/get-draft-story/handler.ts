import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { getDraftStory } from "./service";
import type { GetDraftStoryInput, GetDraftStoryResult } from "./types";

// Modo teste do autor: a obra como está no editor (rascunho incluso), para jogar de qualquer cena.
export async function getDraftStoryHandler(input: GetDraftStoryInput): Promise<GetDraftStoryResult> {
  if (typeof input.workId !== "string" || !input.workId) return { success: false, error: { code: "novels.invalid_work", message: "Obra não informada." } };
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return getDraftStory(input);
}
