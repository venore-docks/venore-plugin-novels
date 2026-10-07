import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { saveReaderProgress } from "./service";
import type { SaveReaderProgressInput, SaveReaderProgressResult } from "./types";
import { parseProgress } from "./validation";

export async function saveReaderProgressHandler(input: SaveReaderProgressInput): Promise<SaveReaderProgressResult> {
  const progress = parseProgress(input.state);
  if (!progress || typeof input.workId !== "string" || !input.workId) {
    return { success: false, error: { code: "novels.invalid_progress", message: "Progresso inválido." } };
  }

  const user = await getCurrentUser();
  if (!user.success || !user.data) {
    return {
      success: false,
      error: { code: "novels.unauthenticated", message: "Entre na sua conta para salvar o progresso." },
    };
  }
  return saveReaderProgress({ workId: input.workId, progress, userId: user.data.id });
}
