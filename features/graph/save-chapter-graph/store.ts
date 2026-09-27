import { and, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { chapters, choices, scenes, works } from "../../../database/schema";
import type { ChapterGraph } from "../../../contracts/types";

export { findChapterWithWork, findStoryRecords } from "../../../database/queries/story-records";

// Cenas com esses ids que pertencem a OUTRO capítulo/obra: o id vem do client, então um id
// repetido de propósito não pode "sequestrar" a cena de outro lugar via upsert.
export async function findForeignSceneIds(ids: string[], chapterId: string): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db.select({ id: scenes.id, chapterId: scenes.chapterId }).from(scenes).where(inArray(scenes.id, ids));
  return rows.filter((row) => row.chapterId !== chapterId).map((row) => row.id);
}

export async function findForeignChoiceIds(ids: string[], chapterId: string): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: choices.id, chapterId: scenes.chapterId })
    .from(choices)
    .innerJoin(scenes, eq(scenes.id, choices.sceneId))
    .where(inArray(choices.id, ids));
  return rows.filter((row) => row.chapterId !== chapterId).map((row) => row.id);
}

// Substitui o grafo do capítulo numa transação: remove cenas que saíram (as escolhas caem em
// cascata), faz upsert das cenas, recria as escolhas e grava a cena inicial.
export async function replaceChapterGraph(workId: string, chapterId: string, graph: ChapterGraph): Promise<Date> {
  const now = new Date();
  await db.transaction(async (tx) => {
    const keepIds = graph.scenes.map((scene) => scene.id);
    await tx
      .delete(scenes)
      .where(
        keepIds.length > 0
          ? and(eq(scenes.chapterId, chapterId), notInArray(scenes.id, keepIds))
          : eq(scenes.chapterId, chapterId),
      );

    for (const scene of graph.scenes) {
      const values = {
        label: scene.label,
        imageMediaId: scene.imageMediaId,
        body: scene.body,
        isEnding: scene.isEnding,
        endingTitle: scene.endingTitle,
        effects: scene.effects,
        graphX: scene.graphX,
        graphY: scene.graphY,
        updatedAt: now,
      };
      await tx
        .insert(scenes)
        .values({ id: scene.id, workId, chapterId, ...values })
        .onConflictDoUpdate({ target: scenes.id, set: values });
    }

    if (keepIds.length > 0) await tx.delete(choices).where(inArray(choices.sceneId, keepIds));
    if (graph.choices.length > 0) await tx.insert(choices).values(graph.choices);

    await tx.update(chapters).set({ startSceneId: graph.startSceneId, updatedAt: now }).where(eq(chapters.id, chapterId));
    await tx.update(works).set({ updatedAt: now }).where(eq(works.id, workId));
  });
  return now;
}
