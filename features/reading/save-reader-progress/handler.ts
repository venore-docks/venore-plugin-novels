import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { saveReaderProgress } from "./service";
import type { SaveReaderProgressInput, SaveReaderProgressResult } from "./types";
import { parseReaderState } from "./validation";

export async function saveReaderProgressHandler(input: SaveReaderProgressInput): Promise<SaveReaderProgressResult> {
  const state = parseReaderState(input.state);
  if (!state) return { success: false, error: { code: "novels.invalid_progress", message: "Progresso inválido." } };

  const user = await getCurrentUser();
  if (!user.success || !user.data) {
    return {
      success: false,
      error: { code: "novels.unauthenticated", message: "Entre na sua conta para salvar o progresso." },
    };
  }
  return saveReaderProgress({ workId: input.workId, state, userId: user.data.id });
}
