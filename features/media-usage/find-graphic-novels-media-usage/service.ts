import { adminChapterPath, adminWorkPath } from "../../../shared/constants";
import { pickText } from "../../../shared/localized-text";
import { findScenesByImageMediaId, findWorksByCoverMediaId } from "./store";
import type { FindGraphicNovelsMediaUsageResult } from "./types";

// Contrato de "quem usa esta mídia" (platform/media-usage): impede apagar do acervo uma imagem
// que ainda é capa ou lâmina de alguma obra.
export async function findGraphicNovelsMediaUsage(mediaId: string): Promise<FindGraphicNovelsMediaUsageResult> {
  const [covers, sceneImages] = await Promise.all([findWorksByCoverMediaId(mediaId), findScenesByImageMediaId(mediaId)]);
  return [
    ...covers.map((work) => ({
      consumerKey: "graphic-novels",
      consumerLabel: "Graphic Novels",
      label: `Capa de "${pickText(work.title, work.defaultLocale, work.defaultLocale)}"`,
      href: adminWorkPath(work.id),
    })),
    ...sceneImages.map((row) => ({
      consumerKey: "graphic-novels",
      consumerLabel: "Graphic Novels",
      label: `Cena "${row.sceneLabel || "sem nome"}" do capítulo ${row.chapterPosition} de "${pickText(row.workTitle, row.defaultLocale, row.defaultLocale)}"`,
      href: adminChapterPath(row.workId, row.chapterId),
    })),
  ];
}
