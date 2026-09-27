import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { deleteWorkRow } from "./store";
import type { DeleteWorkCommand, DeleteWorkResult } from "./types";

export async function deleteWork(command: DeleteWorkCommand): Promise<DeleteWorkResult> {
  const handle = beginOperation({
    useCase: "graphic-novels.delete-work",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });
  const deleted = await deleteWorkRow(command.workId);
  if (!deleted) {
    const error = { code: "graphic-novels.work_not_found", message: "Obra não encontrada." };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }
  endOperation(handle, { success: true });
  return { success: true, data: { id: command.workId } };
}
