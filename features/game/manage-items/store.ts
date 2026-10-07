import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { items, works } from "../../../database/schema";
import { findStoryRecords, findWorkRowById } from "../../../database/queries/story-records";
import type { ItemFields } from "../../../shared/game-input";

export { findStoryRecords, findWorkRowById as findWorkById };

export async function countItems(workId: string): Promise<number> {
  const [row] = await db.select({ total: count() }).from(items).where(eq(items.workId, workId));
  return row?.total ?? 0;
}

export async function findItemIdByKey(workId: string, key: string): Promise<string | null> {
  const [row] = await db.select({ id: items.id }).from(items).where(and(eq(items.workId, workId), eq(items.key, key))).limit(1);
  return row?.id ?? null;
}

async function touchWork(workId: string) {
  await db.update(works).set({ updatedAt: new Date() }).where(eq(works.id, workId));
}

export async function insertItem(workId: string, fields: ItemFields): Promise<string> {
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${items.position}), -1)::int + 1` })
    .from(items)
    .where(eq(items.workId, workId));
  const [row] = await db.insert(items).values({ workId, ...fields, position: next }).returning({ id: items.id });
  await touchWork(workId);
  return row.id;
}

export async function updateItem(workId: string, id: string, fields: ItemFields): Promise<boolean> {
  const rows = await db
    .update(items)
    .set({ ...fields, updatedAt: new Date() })
    .where(and(eq(items.id, id), eq(items.workId, workId)))
    .returning({ id: items.id });
  if (rows.length > 0) await touchWork(workId);
  return rows.length > 0;
}

export async function deleteItem(workId: string, id: string): Promise<boolean> {
  const rows = await db.delete(items).where(and(eq(items.id, id), eq(items.workId, workId))).returning({ id: items.id });
  if (rows.length > 0) await touchWork(workId);
  return rows.length > 0;
}

export async function reorderItems(workId: string, orderedIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [position, id] of orderedIds.entries()) {
      await tx.update(items).set({ position }).where(and(eq(items.id, id), eq(items.workId, workId)));
    }
  });
}
