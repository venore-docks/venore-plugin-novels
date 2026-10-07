import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { parseStartAction } from "../save-reader-progress/validation";
import { startReaderGame } from "./service";
import type { StartReaderGameInput, StartReaderGameResult } from "./types";

// Nova partida de quem tem conta: a semente dos dados sai do servidor.
export async function startReaderGameHandler(input: StartReaderGameInput): Promise<StartReaderGameResult> {
  const start = parseStartAction(input.start);
  if (!start || typeof input.workId !== "string" || !input.workId) {
    return { success: false, error: { code: "novels.invalid_progress", message: "Início de partida inválido." } };
  }
  const user = await getCurrentUser();
  if (!user.success || !user.data) {
    return { success: false, error: { code: "novels.unauthenticated", message: "Entre na sua conta para salvar o progresso." } };
  }
  return startReaderGame({ workId: input.workId, start, userId: user.data.id });
}
