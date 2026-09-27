import { eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { chapters, scenes, works } from "../../../database/schema";

export async function findWorksByCoverMediaId(mediaId: string) {
  return db.select({ id: works.id, title: works.title, defaultLocale: works.defaultLocale }).from(works).where(eq(works.coverMediaId, mediaId));
}

export async function findScenesByImageMediaId(mediaId: string) {
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
    .where(eq(scenes.imageMediaId, mediaId));
}
