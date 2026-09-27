import { cache } from "react";
import type { BreadcrumbSegmentDefinition } from "@venore/plugin-sdk";
import { dynamicBreadcrumbSegment, staticBreadcrumbSegment } from "@venore/plugin-sdk";
import { getChapterGraphHandler } from "./features/graph/get-chapter-graph/handler";
import { getPublishedStoryHandler } from "./features/reading/get-published-story/handler";
import { getWorkHandler } from "./features/works/get-work/handler";
import { pickText } from "./shared/localized-text";

// cache() dedupe por argumento primitivo: as páginas chamam estas mesmas funções, então o
// breadcrumb não custa uma query a mais no request.
export const getCachedPublishedStory = cache((slug: string) => getPublishedStoryHandler({ slug }));
export const getCachedWork = cache((workId: string) => getWorkHandler({ workId }));
export const getCachedChapterGraph = cache((workId: string, chapterId: string) =>
  getChapterGraphHandler({ workId, chapterId }),
);

export const graphicNovelsBreadcrumbSegments: BreadcrumbSegmentDefinition[] = [
  staticBreadcrumbSegment({ key: "graphic-novels.public", segments: ["novels"], label: "Graphic Novels" }),
  dynamicBreadcrumbSegment({
    key: "graphic-novels.public.work",
    segments: ["novels", ":workSlug"],
    paramName: "workSlug",
    resolveLabel: async (slug) => {
      const result = await getCachedPublishedStory(slug);
      return result.success ? pickText(result.data.work.title, result.data.work.defaultLocale, result.data.work.defaultLocale) : null;
    },
  }),
  staticBreadcrumbSegment({ key: "graphic-novels.admin", segments: ["admin", "graphic-novels"], label: "Graphic Novels" }),
  staticBreadcrumbSegment({
    key: "graphic-novels.admin.works",
    segments: ["admin", "graphic-novels", "works"],
    label: "Obras",
    href: "/admin/graphic-novels",
  }),
  dynamicBreadcrumbSegment({
    key: "graphic-novels.admin.work",
    segments: ["admin", "graphic-novels", "works", ":workId"],
    paramName: "workId",
    resolveLabel: async (workId) => {
      const result = await getCachedWork(workId);
      return result.success ? pickText(result.data.work.title, result.data.work.defaultLocale, result.data.work.defaultLocale) : null;
    },
  }),
  staticBreadcrumbSegment({
    key: "graphic-novels.admin.chapters",
    segments: ["admin", "graphic-novels", "works", ":workId", "chapters"],
    label: "Capítulos",
    href: null,
  }),
  {
    key: "graphic-novels.admin.chapter",
    segments: ["admin", "graphic-novels", "works", ":workId", "chapters", ":chapterId"],
    resolve: async (params) => {
      const result = await getCachedChapterGraph(params.workId, params.chapterId);
      if (!result.success) return null;
      return {
        label: `Capítulo ${result.data.chapterNumber}`,
        href: `/admin/graphic-novels/works/${params.workId}/chapters/${params.chapterId}`,
      };
    },
  },
];
