import { syncSpeechAudio } from "@venore/plugin-sdk/speech";
import { speechItemsForWork, workSpeechScope } from "../../../shared/speech";
import { findStoryRecords, findWorkById } from "./store";

// Deixa o áudio da obra igual ao que o autor escolheu e ao texto publicado: "Gerar áudio" ligado
// e obra publicada -> uma faixa por cena e idioma (o core só gera o que mudou); opção desligada ou
// obra apagada -> nenhuma. Obra em rascunho com a opção ligada fica como está: quem despublica
// para reestruturar e republica não gera de novo o que não mudou (o leitor só abre obra
// publicada). Áudio é acessório: falha aqui nunca desfaz a mudança.
export async function syncWorkSpeech(workId: string): Promise<void> {
  try {
    const work = await findWorkById(workId);
    if (work && work.speechEnabled && work.status !== "published") return;
    const items = work?.speechEnabled ? speechItemsForWork(work, (await findStoryRecords(work)).scenes) : [];
    await syncSpeechAudio({ scope: workSpeechScope(workId), items });
  } catch (error) {
    console.warn(`[novels] não deu pra sincronizar o áudio da obra ${workId}:`, error);
  }
}
