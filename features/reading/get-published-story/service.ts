import { getSpeechAudio } from "@venore/plugin-sdk/speech";
import { buildStory, collectMediaIds } from "../../../shared/build-story";
import { resolveMediaUrls } from "../../../shared/resolve-media-urls";
import { indexSceneAudio, workSpeechScope } from "../../../shared/speech";
import { findStoryRecords, findWorkBySlug } from "./store";
import type { GetPublishedStoryInput, GetPublishedStoryResult } from "./types";

// A obra inteira vai pro client de uma vez (o motor roda no navegador). Obra com escolhas
// secretas fica visível pra quem inspecionar a página: é o preço de ler sem ida ao servidor a
// cada escolha, aceitável pra ficção.
export async function getPublishedStory(input: GetPublishedStoryInput): Promise<GetPublishedStoryResult> {
  const work = await findWorkBySlug(input.slug);
  if (!work || work.status !== "published") {
    return { success: false, error: { code: "novels.work_not_found", message: "Obra não encontrada." } };
  }
  const scope = workSpeechScope(work.id);
  const [records, speech] = await Promise.all([findStoryRecords(work), getSpeechAudio({ scopes: [scope] })]);
  const urls = await resolveMediaUrls(collectMediaIds(records));
  // Áudio é acessório: sem ele (falha de leitura), a obra abre normal, só sem botão de ouvir.
  const audio = speech.success ? indexSceneAudio(speech.data[scope] ?? []) : {};
  return { success: true, data: buildStory(records, urls, audio) };
}
