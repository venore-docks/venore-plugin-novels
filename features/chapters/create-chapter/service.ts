import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { findWorkById, insertChapterAtEnd } from "./store";
import type { CreateChapterCommand, CreateChapterResult } from "./types";

export async function createChapter(command: CreateChapterCommand): Promise<CreateChapterResult> {
  const handle = beginOperation({
    useCase: "novels.create-chapter",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });
  const work = await findWorkById(command.workId);
  if (!work) {
    const error = { code: "novels.work_not_found", message: "Obra não encontrada." };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }
  // Capítulo novo nasce vazio. Numa obra publicada ele só aparece pro leitor quando tiver cena
  // inicial (o motor pula capítulo sem início), mas o validador acusa capítulo vazio: por isso
  // publicar de novo exige preenchê-lo.
  const chapter = await insertChapterAtEnd(work.id, { [work.defaultLocale]: command.title.trim() });
  endOperation(handle, { success: true });
  return { success: true, data: chapter };
}
