import { eq, sql } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { castMembers, chapters, scenes, works } from "../../../database/schema";

export async function findWorksByCoverMediaId(mediaId: string) {
  return db.select({ id: works.id, title: works.title, defaultLocale: works.defaultLocale }).from(works).where(eq(works.coverMediaId, mediaId));
}

// Mídia dentro dos blocos da cena (imagem, legenda, galeria, fundo): busca no JSON pelo campo
// "mediaId" com o id exato.
export async function findScenesByMediaId(mediaId: string) {
  const needle = `"mediaId": ${JSON.stringify(mediaId)}`;
  return db
    .select({
      sceneLabel: scenes.label,
      workId: works.id,
      workTitle: works.title,
      defaultLocale: works.defaultLocale,
      chapterId: chapters.id,
      chapterPosition: chapters.position,
    })
    .from(scenes)
    .innerJoin(chapters, eq(chapters.id, scenes.chapterId))
    .innerJoin(works, eq(works.id, scenes.workId))
    .where(sql`position(${needle} in ${scenes.blocks}::text) > 0`);
}

export async function findCastByPortraitMediaId(mediaId: string) {
  return db
    .select({ name: castMembers.name, workId: works.id, workTitle: works.title, defaultLocale: works.defaultLocale })
    .from(castMembers)
    .innerJoin(works, eq(works.id, castMembers.workId))
    .where(eq(castMembers.portraitMediaId, mediaId));
}
