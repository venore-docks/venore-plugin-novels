import { buildStory, collectMediaIds } from "../../../shared/build-story";
import { resolveMediaUrls } from "../../../shared/resolve-media-urls";
import { findStoryRecords, findWorkBySlug } from "./store";
import type { GetPublishedStoryInput, GetPublishedStoryResult } from "./types";

// A obra inteira vai pro client de uma vez (o motor roda no navegador). Obra com escolhas
// secretas fica visível pra quem inspecionar a página: é o preço de ler sem ida ao servidor a
// cada escolha, aceitável pra ficção.
export async function getPublishedStory(input: GetPublishedStoryInput): Promise<GetPublishedStoryResult> {
  const work = await findWorkBySlug(input.slug);
  if (!work || work.status !== "published") {
    return { success: false, error: { code: "graphic-novels.work_not_found", message: "Obra não encontrada." } };
  }
  const records = await findStoryRecords(work);
  const urls = await resolveMediaUrls(collectMediaIds(records));
  return { success: true, data: buildStory(records, urls) };
}
