import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { creatures, works } from "../../../database/schema";
import { findStoryRecords, findWorkRowById } from "../../../database/queries/story-records";
import type { CreatureFields } from "../../../shared/game-input";

export { findStoryRecords, findWorkRowById as findWorkById };

export async function countCreatures(workId: string): Promise<number> {
  const [row] = await db.select({ total: count() }).from(creatures).where(eq(creatures.workId, workId));
  return row?.total ?? 0;
}

export async function findCreatureIdByKey(workId: string, key: string): Promise<string | null> {
  const [row] = await db.select({ id: creatures.id }).from(creatures).where(and(eq(creatures.workId, workId), eq(creatures.key, key))).limit(1);
  return row?.id ?? null;
}

async function touchWork(workId: string) {
  await db.update(works).set({ updatedAt: new Date() }).where(eq(works.id, workId));
}

export async function insertCreature(workId: string, fields: CreatureFields): Promise<string> {
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${creatures.position}), -1)::int + 1` })
    .from(creatures)
    .where(eq(creatures.workId, workId));
  const [row] = await db.insert(creatures).values({ workId, ...fields, position: next }).returning({ id: creatures.id });
  await touchWork(workId);
  return row.id;
}

export async function updateCreature(workId: string, id: string, fields: CreatureFields): Promise<boolean> {
  const rows = await db
    .update(creatures)
    .set({ ...fields, updatedAt: new Date() })
    .where(and(eq(creatures.id, id), eq(creatures.workId, workId)))
    .returning({ id: creatures.id });
  if (rows.length > 0) await touchWork(workId);
  return rows.length > 0;
}

export async function deleteCreature(workId: string, id: string): Promise<boolean> {
  const rows = await db.delete(creatures).where(and(eq(creatures.id, id), eq(creatures.workId, workId))).returning({ id: creatures.id });
  if (rows.length > 0) await touchWork(workId);
  return rows.length > 0;
}

export async function reorderCreatures(workId: string, orderedIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [position, id] of orderedIds.entries()) {
      await tx.update(creatures).set({ position }).where(and(eq(creatures.id, id), eq(creatures.workId, workId)));
    }
  });
}
