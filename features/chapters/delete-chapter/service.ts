import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { blockingIssueForPublished } from "../../../shared/published-guard";
import { deleteChapterAndCompact, findChapterWithWork, findStoryRecords } from "./store";
import type { DeleteChapterCommand, DeleteChapterResult } from "./types";

export async function deleteChapter(command: DeleteChapterCommand): Promise<DeleteChapterResult> {
  const handle = beginOperation({
    useCase: "graphic-novels.delete-chapter",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });
  const fail = (code: string, message: string): DeleteChapterResult => {
    const error = { code, message };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  };

  const found = await findChapterWithWork(command.chapterId);
  if (!found) return fail("graphic-novels.chapter_not_found", "Capítulo não encontrado.");

  const records = await findStoryRecords(found.work);
  if (records.chapters.length <= 1) return fail("graphic-novels.last_chapter", "A obra precisa ter pelo menos um capítulo.");

  const blocking = blockingIssueForPublished(found.work.status, {
    ...records,
    chapters: records.chapters.filter((chapter) => chapter.id !== found.chapter.id),
    scenes: records.scenes.filter((scene) => scene.chapterId !== found.chapter.id),
  });
  if (blocking) return fail("graphic-novels.would_break_published", `A obra publicada ficaria com erro: ${blocking}`);

  await deleteChapterAndCompact(found.chapter.id, found.work.id, found.chapter.position);
  endOperation(handle, { success: true });
  return { success: true, data: { workId: found.work.id } };
}
