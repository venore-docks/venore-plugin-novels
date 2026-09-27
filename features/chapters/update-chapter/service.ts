import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { normalizeLocalizedText } from "../../../shared/localized-text";
import { findChapterWithWork, updateChapterTitle } from "./store";
import type { UpdateChapterCommand, UpdateChapterResult } from "./types";

export async function updateChapter(command: UpdateChapterCommand): Promise<UpdateChapterResult> {
  const handle = beginOperation({
    useCase: "graphic-novels.update-chapter",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });
  const found = await findChapterWithWork(command.chapterId);
  const title = found ? normalizeLocalizedText(command.title, found.work.locales) : {};
  if (!found || !title[found.work.defaultLocale]) {
    const error = found
      ? { code: "graphic-novels.invalid_title", message: "Informe o título no idioma principal." }
      : { code: "graphic-novels.chapter_not_found", message: "Capítulo não encontrado." };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }
  const chapter = await updateChapterTitle(found.chapter.id, title);
  endOperation(handle, { success: true });
  return { success: true, data: chapter };
}
