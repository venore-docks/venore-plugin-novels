import { asc, eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import type { CreatureRecord, ItemRecord } from "../../contracts/game";
import type { CastMemberRecord, ChapterRecord, ChoiceRecord, SceneRecord, WorkRecord } from "../../contracts/types";
import { normalizeChoiceMechanics, normalizeSceneMechanics, normalizeSystem } from "../../shared/engine/system";
import { toCreatureRecord, toItemRecord } from "../../shared/game-records";
import { castMembers, chapters, choices, creatures, items, scenes, works } from "../schema";

// Leituras compartilhadas pelos store.ts que precisam da obra inteira (validação, publicação,
// leitor). Cada store.ts continua sendo o único ponto de acesso do seu caso de uso; este módulo
// só evita repetir as mesmas queries em cada um.

export type WorkStoryRecords = {
  work: WorkRecord;
  chapters: ChapterRecord[];
  scenes: SceneRecord[];
  choices: ChoiceRecord[];
  cast: CastMemberRecord[];
  items: ItemRecord[];
  creatures: CreatureRecord[];
};

export function toWorkRecord(row: typeof works.$inferSelect): WorkRecord {
  return { ...row, status: row.status as WorkRecord["status"], coverFocus: row.coverFocus ?? null, gameSystem: normalizeSystem(row.gameSystem) };
}

export async function findWorkRowById(workId: string): Promise<WorkRecord | null> {
  const [row] = await db.select().from(works).where(eq(works.id, workId)).limit(1);
  return row ? toWorkRecord(row) : null;
}

export async function findWorkRowBySlug(slug: string): Promise<WorkRecord | null> {
  const [row] = await db.select().from(works).where(eq(works.slug, slug)).limit(1);
  return row ? toWorkRecord(row) : null;
}

export async function findCastRows(workId: string): Promise<CastMemberRecord[]> {
  return db.select({
    id: castMembers.id,
    workId: castMembers.workId,
    name: castMembers.name,
    color: castMembers.color,
    portraitMediaId: castMembers.portraitMediaId,
    position: castMembers.position,
  })
    .from(castMembers)
    .where(eq(castMembers.workId, workId))
    .orderBy(asc(castMembers.position), asc(castMembers.createdAt));
}

export async function findItemRows(workId: string): Promise<ItemRecord[]> {
  const rows = await db.select().from(items).where(eq(items.workId, workId)).orderBy(asc(items.position), asc(items.createdAt));
  return rows.map(toItemRecord);
}

export async function findCreatureRows(workId: string): Promise<CreatureRecord[]> {
  const rows = await db.select().from(creatures).where(eq(creatures.workId, workId)).orderBy(asc(creatures.position), asc(creatures.createdAt));
  return rows.map(toCreatureRecord);
}

export async function findStoryRecords(work: WorkRecord): Promise<WorkStoryRecords> {
  const [chapterRows, sceneRows, choiceRows, cast, itemRows, creatureRows] = await Promise.all([
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
        mechanics: choices.mechanics,
      })
      .from(choices)
      .innerJoin(scenes, eq(scenes.id, choices.sceneId))
      .where(eq(scenes.workId, work.id))
      .orderBy(asc(choices.position)),
    findCastRows(work.id),
    findItemRows(work.id),
    findCreatureRows(work.id),
  ]);
  return {
    work,
    chapters: chapterRows,
    scenes: sceneRows.map((row) => ({
      id: row.id,
      workId: row.workId,
      chapterId: row.chapterId,
      label: row.label,
      blocks: row.blocks,
      isEnding: row.isEnding,
      endingTitle: row.endingTitle,
      effects: row.effects,
      mechanics: normalizeSceneMechanics(row.mechanics),
      graphX: row.graphX,
      graphY: row.graphY,
    })),
    choices: choiceRows.map((row) => ({ ...row, mechanics: normalizeChoiceMechanics(row.mechanics) })),
    cast,
    items: itemRows,
    creatures: creatureRows,
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
