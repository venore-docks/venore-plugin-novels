import { adminChapterPath, adminWorkPath, adminWorkTabPath } from "../../../shared/constants";
import { pickText } from "../../../shared/localized-text";
import { findCastByPortraitMediaId, findScenesByMediaId, findWorksByCoverMediaId } from "./store";
import type { FindNovelsMediaUsageResult } from "./types";

// Contrato de "quem usa esta mídia" (platform/media-usage): impede apagar do acervo uma imagem
// que ainda é capa, imagem de cena ou retrato do elenco de alguma obra.
export async function findNovelsMediaUsage(mediaId: string): Promise<FindNovelsMediaUsageResult> {
  const [covers, sceneImages, portraits] = await Promise.all([
    findWorksByCoverMediaId(mediaId),
    findScenesByMediaId(mediaId),
    findCastByPortraitMediaId(mediaId),
  ]);
  const workTitle = (row: { workTitle: Record<string, string>; defaultLocale: string }) =>
    pickText(row.workTitle, row.defaultLocale, row.defaultLocale);
  return [
    ...covers.map((work) => ({
      consumerKey: "novels",
      consumerLabel: "Graphic Novels",
      label: `Capa de "${pickText(work.title, work.defaultLocale, work.defaultLocale)}"`,
      href: adminWorkPath(work.id),
    })),
    ...sceneImages.map((row) => ({
      consumerKey: "novels",
      consumerLabel: "Graphic Novels",
      label: `Cena "${row.sceneLabel || "sem nome"}" do capítulo ${row.chapterPosition} de "${workTitle(row)}"`,
      href: adminChapterPath(row.workId, row.chapterId),
    })),
    ...portraits.map((row) => ({
      consumerKey: "novels",
      consumerLabel: "Graphic Novels",
      label: `Retrato de "${pickText(row.name, row.defaultLocale, row.defaultLocale)}" no elenco de "${workTitle(row)}"`,
      href: adminWorkTabPath(row.workId, "elenco"),
    })),
  ];
}
