import { getSpeechState, syncSpeechAudio } from "@venore/plugin-sdk/speech";
import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { adminWorkTabPath } from "../../../shared/constants";
import { pickText } from "../../../shared/localized-text";
import { speechItemsForWork, workSpeechScope } from "../../../shared/speech";
import { findStoryRecords, findWorkById, setWorkSpeechEnabled } from "./store";
import type {
  DeleteWorkSpeechCommand,
  DeleteWorkSpeechResult,
  GenerateWorkSpeechCommand,
  GenerateWorkSpeechResult,
} from "./types";

// Áudio da obra por ação explícita do autor (bloco "Áudio" da tela da obra). Salvar a obra,
// publicar ou editar cenas não mexem no áudio: texto mudado aparece como desatualizado e o áudio
// antigo continua tocando até o autor pedir para gerar de novo.
export async function generateWorkSpeech(command: GenerateWorkSpeechCommand): Promise<GenerateWorkSpeechResult> {
  const handle = beginOperation({ useCase: "novels.generate-work-speech", actor: { id: command.actorId, type: "user" }, kind: "write" });
  const fail = (code: string, message: string): GenerateWorkSpeechResult => {
    const error = { code, message };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  };

  const work = await findWorkById(command.workId);
  if (!work) return fail("novels.work_not_found", "Obra não encontrada.");
  const records = await findStoryRecords(work);
  const items = speechItemsForWork(work, records.scenes, records.cast);
  if (items.length === 0) return fail("novels.speech_no_text", "Nenhuma cena com texto para gerar áudio.");

  const scope = workSpeechScope(work.id);
  const state = await getSpeechState({ scope, items });
  if (!state.success) return fail(state.error.code, state.error.message);
  if (!state.data.active) {
    return fail("novels.speech_disabled", "A leitura em voz alta está desligada: ligue em Editorial → Áudios.");
  }

  // `source`: título e link desta tela no painel de áudios do core (Editorial → Áudios).
  const result = await syncSpeechAudio({
    scope,
    items,
    regenerate: command.mode === "all",
    source: { label: pickText(work.title, work.defaultLocale, work.defaultLocale), href: adminWorkTabPath(work.id, "audio") },
  });
  if (!result.success) return fail(result.error.code, result.error.message);
  await setWorkSpeechEnabled(work.id, true);
  endOperation(handle, { success: true, detail: result.data });
  return result;
}

export async function deleteWorkSpeech(command: DeleteWorkSpeechCommand): Promise<DeleteWorkSpeechResult> {
  const handle = beginOperation({ useCase: "novels.delete-work-speech", actor: { id: command.actorId, type: "user" }, kind: "write" });
  const work = await findWorkById(command.workId);
  if (!work) {
    const error = { code: "novels.work_not_found", message: "Obra não encontrada." };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }
  const result = await syncSpeechAudio({ scope: workSpeechScope(work.id), items: [] });
  if (!result.success) {
    endOperation(handle, { success: false, error: result.error });
    return result;
  }
  await setWorkSpeechEnabled(work.id, false);
  endOperation(handle, { success: true });
  return { success: true, data: { removed: result.data.removed } };
}

// Obra apagada: o áudio sai junto. Áudio é acessório: falha aqui nunca desfaz a exclusão.
export async function removeWorkSpeech(workId: string): Promise<void> {
  try {
    await syncSpeechAudio({ scope: workSpeechScope(workId), items: [] });
  } catch (error) {
    console.warn(`[novels] não deu pra apagar o áudio da obra ${workId}:`, error);
  }
}
