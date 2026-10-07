import type { BreadcrumbSegmentDefinition } from "@venore/plugin-sdk";
import { dynamicBreadcrumbSegment, staticBreadcrumbSegment } from "@venore/plugin-sdk";
import { pickText } from "./shared/localized-text";

// Este arquivo entra no grafo de contributions.generated.ts do core, então não pode importar
// handler no topo: a cadeia handler -> SDK (rbac/auth) volta até o registro de contributions e o
// build de produção quebra com TDZ ("Cannot access before initialization"). As consultas entram
// por import dinâmico só na hora de resolver o rótulo.
const queries = () => import("./shared/cached-queries");

export const novelsBreadcrumbSegments: BreadcrumbSegmentDefinition[] = [
  staticBreadcrumbSegment({ key: "novels.public", segments: ["novels"], label: "Graphic Novels" }),
  dynamicBreadcrumbSegment({
    key: "novels.public.work",
    segments: ["novels", ":workSlug"],
    paramName: "workSlug",
    resolveLabel: async (slug) => {
      const result = await (await queries()).getCachedPublishedStory(slug);
      return result.success ? pickText(result.data.work.title, result.data.work.defaultLocale, result.data.work.defaultLocale) : null;
    },
  }),
  staticBreadcrumbSegment({ key: "novels.admin", segments: ["admin", "novels"], label: "Graphic Novels" }),
  staticBreadcrumbSegment({ key: "novels.admin.new", segments: ["admin", "novels", "new"], label: "Nova obra" }),
  staticBreadcrumbSegment({ key: "novels.admin.tags", segments: ["admin", "novels", "tags"], label: "Tags" }),
  staticBreadcrumbSegment({
    key: "novels.admin.works",
    segments: ["admin", "novels", "works"],
    label: "Obras",
    href: "/admin/novels",
  }),
  dynamicBreadcrumbSegment({
    key: "novels.admin.work",
    segments: ["admin", "novels", "works", ":workId"],
    paramName: "workId",
    resolveLabel: async (workId) => {
      const result = await (await queries()).getCachedWork(workId);
      return result.success ? pickText(result.data.work.title, result.data.work.defaultLocale, result.data.work.defaultLocale) : null;
    },
  }),
  staticBreadcrumbSegment({
    key: "novels.admin.chapters",
    segments: ["admin", "novels", "works", ":workId", "chapters"],
    label: "Capítulos",
    href: null,
  }),
  {
    key: "novels.admin.chapter",
    segments: ["admin", "novels", "works", ":workId", "chapters", ":chapterId"],
    resolve: async (params) => {
      const result = await (await queries()).getCachedChapterGraph(params.workId, params.chapterId);
      if (!result.success) return null;
      return {
        label: `Capítulo ${result.data.chapterNumber}`,
        href: `/admin/novels/works/${params.workId}/chapters/${params.chapterId}`,
      };
    },
  },
];
