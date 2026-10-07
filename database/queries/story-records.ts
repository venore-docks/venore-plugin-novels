import { asc, eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import type { ChapterRecord, ChoiceRecord, SceneRecord, WorkRecord } from "../../contracts/types";
import { chapters, choices, scenes, works } from "../schema";
import { normalizeTags } from "../../shared/tags";

// Leituras compartilhadas pelos store.ts que precisam da obra inteira (validação, publicação,
// leitor). Cada store.ts continua sendo o único ponto de acesso do seu caso de uso; este módulo
// só evita repetir as mesmas quatro queries em cada um.

export type WorkStoryRecords = {
  work: WorkRecord;
  chapters: ChapterRecord[];
  scenes: SceneRecord[];
  choices: ChoiceRecord[];
};

export function toWorkRecord(row: typeof works.$inferSelect): WorkRecord {
  return { ...row, status: row.status as WorkRecord["status"], tags: normalizeTags(row.tags) };
}

export async function findWorkRowById(workId: string): Promise<WorkRecord | null> {
  const [row] = await db.select().from(works).where(eq(works.id, workId)).limit(1);
  return row ? toWorkRecord(row) : null;
}

export async function findWorkRowBySlug(slug: string): Promise<WorkRecord | null> {
  const [row] = await db.select().from(works).where(eq(works.slug, slug)).limit(1);
  return row ? toWorkRecord(row) : null;
}

export async function findStoryRecords(work: WorkRecord): Promise<WorkStoryRecords> {
  const [chapterRows, sceneRows, choiceRows] = await Promise.all([
    db.select().from(chapters).where(eq(chapters.workId, work.id)).orderBy(asc(chapters.position)),
    db.select().from(scenes).where(eq(scenes.workId, work.id)),
    db
      .select({
        id: choices.id,
        sceneId: choices.sceneId,
        targetSceneId: choices.targetSceneId,
        position: choices.position,
        label: choices.label,
        conditions: choices.conditions,
        effects: choices.effects,
      })
      .from(choices)
      .innerJoin(scenes, eq(scenes.id, choices.sceneId))
      .where(eq(scenes.workId, work.id))
      .orderBy(asc(choices.position)),
  ]);
  return {
    work,
    chapters: chapterRows,
    scenes: sceneRows.map((row) => ({
      id: row.id,
      workId: row.workId,
      chapterId: row.chapterId,
      label: row.label,
      imageMediaId: row.imageMediaId,
      body: row.body,
      isEnding: row.isEnding,
      endingTitle: row.endingTitle,
      effects: row.effects,
      graphX: row.graphX,
      graphY: row.graphY,
    })),
    choices: choiceRows,
  };
}

export async function findChapterWithWork(chapterId: string): Promise<{ chapter: ChapterRecord; work: WorkRecord } | null> {
  const [row] = await db
    .select({ chapter: chapters, work: works })
    .from(chapters)
    .innerJoin(works, eq(works.id, chapters.workId))
    .where(eq(chapters.id, chapterId))
    .limit(1);
  return row ? { chapter: row.chapter, work: toWorkRecord(row.work) } : null;
}

export async function setWorkStatus(workId: string, status: WorkRecord["status"], publishedAt: Date | null): Promise<WorkRecord> {
  const [row] = await db
    .update(works)
    .set({ status, publishedAt, updatedAt: new Date() })
    .where(eq(works.id, workId))
    .returning();
  return toWorkRecord(row);
}
