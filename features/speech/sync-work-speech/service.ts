import { syncSpeechAudio } from "@venore/plugin-sdk/speech";
import { speechItemsForWork, workSpeechScope } from "../../../shared/speech";
import { findStoryRecords, findWorkById } from "./store";

// Deixa o áudio da obra igual ao texto publicado: obra publicada -> uma faixa por cena e idioma
// (o core só gera o que mudou); obra apagada -> nenhuma. Obra em rascunho fica como está: quem
// despublica para reestruturar e republica não paga de novo pelo que não mudou (o leitor só abre
// obra publicada, então o áudio parado não aparece). Áudio é acessório: falha aqui nunca desfaz
// a mudança.
export async function syncWorkSpeech(workId: string): Promise<void> {
  try {
    const work = await findWorkById(workId);
    if (work && work.status !== "published") return;
    const items = work ? speechItemsForWork(work, (await findStoryRecords(work)).scenes) : [];
    await syncSpeechAudio({ scope: workSpeechScope(workId), items });
  } catch (error) {
    console.warn(`[novels] não deu pra sincronizar o áudio da obra ${workId}:`, error);
  }
}
