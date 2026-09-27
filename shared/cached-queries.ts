import { cache } from "react";
import { getChapterGraphHandler } from "../features/graph/get-chapter-graph/handler";
import { getPublishedStoryHandler } from "../features/reading/get-published-story/handler";
import { getWorkHandler } from "../features/works/get-work/handler";

// cache() dedupe por argumento primitivo: as páginas e o breadcrumb chamam estas mesmas funções,
// então o breadcrumb não custa uma query a mais no request.
export const getCachedPublishedStory = cache((slug: string) => getPublishedStoryHandler({ slug }));
export const getCachedWork = cache((workId: string) => getWorkHandler({ workId }));
export const getCachedChapterGraph = cache((workId: string, chapterId: string) =>
  getChapterGraphHandler({ workId, chapterId }),
);
