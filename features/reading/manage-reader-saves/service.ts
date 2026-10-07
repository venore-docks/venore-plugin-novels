import { storyForEngine } from "../../../shared/build-story";
import { createContext } from "../../../shared/engine/context";
import { replay, toSaved } from "../../../shared/engine/play";
import type { SavedGame } from "../../../shared/engine/types";
import * as store from "./store";
import type {
  DeleteReaderSlotInput,
  DeleteReaderSlotResult,
  ListReaderSavesInput,
  ListReaderSavesResult,
  LoadReaderSlotInput,
  LoadReaderSlotResult,
  SaveReaderSlotResult,
  WithUser,
} from "./types";

export async function listReaderSaves(input: WithUser<ListReaderSavesInput>): Promise<ListReaderSavesResult> {
  return { success: true, data: await store.findSaves(input.userId, input.workId) };
}

// Salvar num espaço: mesma conferência do progresso (o registro é refeito pelas regras da obra).
// Partida hardcore tem um salvamento só, o automático.
export async function saveReaderSlot(input: { workId: string; slot: number; name: string; saved: SavedGame; userId: string }): Promise<SaveReaderSlotResult> {
  const work = await store.findWorkById(input.workId);
  if (!work || work.status !== "published") return { success: false, error: { code: "novels.work_not_found", message: "Obra não encontrada." } };
  const records = await store.findStoryRecords(work);
  const ctx = createContext(storyForEngine(records));
  const { state } = replay(ctx, input.saved);
  if (state.hardcore) {
    return { success: false, error: { code: "novels.hardcore_single_save", message: "No modo hardcore a partida tem um salvamento só." } };
  }
  const chapterId = ctx.scenes.get(state.sceneId)?.chapterId;
  const chapterTitle = records.chapters.find((chapter) => chapter.id === chapterId)?.title ?? {};
  const slot = await store.upsertSave(input.userId, work.id, { slot: input.slot, name: input.name, chapterTitle, state: toSaved(state) });
  return { success: true, data: slot };
}

export async function deleteReaderSlot(input: WithUser<DeleteReaderSlotInput>): Promise<DeleteReaderSlotResult> {
  await store.deleteSave(input.userId, input.workId, input.slot);
  return { success: true, data: null };
}

export async function loadReaderSlot(input: WithUser<LoadReaderSlotInput>): Promise<LoadReaderSlotResult> {
  const slot = (await store.findSaves(input.userId, input.workId)).find((entry) => entry.slot === input.slot);
  if (!slot) return { success: false, error: { code: "novels.save_not_found", message: "Salvamento não encontrado." } };
  await store.upsertReaderProgress(input.userId, input.workId, slot.state);
  return { success: true, data: slot.state };
}
