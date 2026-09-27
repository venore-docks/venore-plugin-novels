import type { BreadcrumbSegmentDefinition } from "@venore/plugin-sdk";
import { dynamicBreadcrumbSegment, staticBreadcrumbSegment } from "@venore/plugin-sdk";
import { pickText } from "./shared/localized-text";

// Este arquivo entra no grafo de contributions.generated.ts do core, então não pode importar
// handler no topo: a cadeia handler -> SDK (rbac/auth) volta até o registro de contributions e o
// build de produção quebra com TDZ ("Cannot access before initialization"). As consultas entram
// por import dinâmico só na hora de resolver o rótulo.
const queries = () => import("./shared/cached-queries");

export const graphicNovelsBreadcrumbSegments: BreadcrumbSegmentDefinition[] = [
  staticBreadcrumbSegment({ key: "graphic-novels.public", segments: ["novels"], label: "Graphic Novels" }),
  dynamicBreadcrumbSegment({
    key: "graphic-novels.public.work",
    segments: ["novels", ":workSlug"],
    paramName: "workSlug",
    resolveLabel: async (slug) => {
      const result = await (await queries()).getCachedPublishedStory(slug);
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
      const result = await (await queries()).getCachedWork(workId);
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
      const result = await (await queries()).getCachedChapterGraph(params.workId, params.chapterId);
      if (!result.success) return null;
      return {
        label: `Capítulo ${result.data.chapterNumber}`,
        href: `/admin/graphic-novels/works/${params.workId}/chapters/${params.chapterId}`,
      };
    },
  },
];
