import { buildStory, collectMediaIds } from "../../../shared/build-story";
import { resolveMediaUrls } from "../../../shared/resolve-media-urls";
import { describeWorkTags } from "../../../shared/tag-catalog";
import { findStoryRecords, findTagCatalog, findWorkById, findWorkTagIds } from "./store";
import type { GetDraftStoryInput, GetDraftStoryResult } from "./types";

export async function getDraftStory(input: GetDraftStoryInput): Promise<GetDraftStoryResult> {
  const work = await findWorkById(input.workId);
  if (!work) return { success: false, error: { code: "novels.work_not_found", message: "Obra não encontrada." } };
  const [records, catalog, tagIds] = await Promise.all([findStoryRecords(work), findTagCatalog(), findWorkTagIds(work.id)]);
  const media = await resolveMediaUrls(collectMediaIds(records));
  return { success: true, data: buildStory(records, { media, tags: describeWorkTags(catalog, tagIds), badges: catalog.badges }) };
}
