import { isValidSlug } from "../../../shared/slug";
import { getPublishedStory } from "./service";
import type { GetPublishedStoryInput, GetPublishedStoryResult } from "./types";

export async function getPublishedStoryHandler(input: GetPublishedStoryInput): Promise<GetPublishedStoryResult> {
  if (!isValidSlug(input.slug)) {
    return { success: false, error: { code: "graphic-novels.work_not_found", message: "Obra não encontrada." } };
  }
  return getPublishedStory(input);
}
