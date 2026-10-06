import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { deleteWorkRow } from "./store";
import type { DeleteWorkCommand, DeleteWorkResult } from "./types";
import { syncWorkSpeech } from "../../speech/sync-work-speech/service";

export async function deleteWork(command: DeleteWorkCommand): Promise<DeleteWorkResult> {
  const handle = beginOperation({
    useCase: "novels.delete-work",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });
  const deleted = await deleteWorkRow(command.workId);
  if (!deleted) {
    const error = { code: "novels.work_not_found", message: "Obra não encontrada." };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }
  // Obra apagada: o áudio dela sai junto (scope vazio).
  await syncWorkSpeech(command.workId);
  endOperation(handle, { success: true });
  return { success: true, data: { id: command.workId } };
}
