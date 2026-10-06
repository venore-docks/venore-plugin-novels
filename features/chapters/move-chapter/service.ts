import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { blockingIssueForPublished } from "../../../shared/published-guard";
import { findChapterWithWork, findStoryRecords, swapChapterPositions } from "./store";
import type { MoveChapterCommand, MoveChapterResult } from "./types";

export async function moveChapter(command: MoveChapterCommand): Promise<MoveChapterResult> {
  const handle = beginOperation({
    useCase: "novels.move-chapter",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });
  const fail = (code: string, message: string): MoveChapterResult => {
    const error = { code, message };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  };

  const found = await findChapterWithWork(command.chapterId);
  if (!found) return fail("novels.chapter_not_found", "Capítulo não encontrado.");
  const records = await findStoryRecords(found.work);
  const ordered = records.chapters;
  const index = ordered.findIndex((chapter) => chapter.id === found.chapter.id);
  const neighbor = ordered[command.direction === "up" ? index - 1 : index + 1];
  if (!neighbor) return fail("novels.cannot_move", "O capítulo já está na ponta.");

  const moved = ordered.map((chapter) =>
    chapter.id === found.chapter.id
      ? { ...chapter, position: neighbor.position }
      : chapter.id === neighbor.id
        ? { ...chapter, position: found.chapter.position }
        : chapter,
  );
  const blocking = blockingIssueForPublished(found.work.status, { ...records, chapters: moved });
  if (blocking) return fail("novels.would_break_published", `A obra publicada ficaria com erro: ${blocking}`);

  await swapChapterPositions(found.chapter, neighbor);
  endOperation(handle, { success: true });
  return { success: true, data: { workId: found.work.id } };
}
