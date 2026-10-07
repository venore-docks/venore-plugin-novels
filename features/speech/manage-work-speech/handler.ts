import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { deleteWorkSpeech, generateWorkSpeech } from "./service";
import type {
  DeleteWorkSpeechInput,
  DeleteWorkSpeechResult,
  GenerateWorkSpeechInput,
  GenerateWorkSpeechResult,
} from "./types";

export async function generateWorkSpeechHandler(input: GenerateWorkSpeechInput): Promise<GenerateWorkSpeechResult> {
  if (!input.workId) return { success: false, error: { code: "novels.invalid_input", message: "Obra não informada." } };
  if (input.mode !== "missing" && input.mode !== "all") {
    return { success: false, error: { code: "novels.invalid_input", message: "Modo de geração inválido." } };
  }
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return generateWorkSpeech({ ...input, actorId: authz.actorId });
}

export async function deleteWorkSpeechHandler(input: DeleteWorkSpeechInput): Promise<DeleteWorkSpeechResult> {
  if (!input.workId) return { success: false, error: { code: "novels.invalid_input", message: "Obra não informada." } };
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return deleteWorkSpeech({ ...input, actorId: authz.actorId });
}
