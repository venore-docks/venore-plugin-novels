import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { castMembers, scenes, works } from "../../../database/schema";
import { findWorkRowById } from "../../../database/queries/story-records";
import type { AccentColor, LocalizedText } from "../../../contracts/types";

export { findWorkRowById as findWorkById };

export async function countCast(workId: string): Promise<number> {
  const [row] = await db.select({ total: count() }).from(castMembers).where(eq(castMembers.workId, workId));
  return row?.total ?? 0;
}

export async function insertCastMember(workId: string, values: { name: LocalizedText; color: AccentColor; portraitMediaId: string | null }) {
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${castMembers.position}), -1)::int + 1` })
    .from(castMembers)
    .where(eq(castMembers.workId, workId));
  const [row] = await db.insert(castMembers).values({ workId, ...values, position: next }).returning({ id: castMembers.id });
  await db.update(works).set({ updatedAt: new Date() }).where(eq(works.id, workId));
  return row.id;
}

export async function updateCastMember(
  workId: string,
  id: string,
  values: { name: LocalizedText; color: AccentColor; portraitMediaId: string | null },
): Promise<boolean> {
  const rows = await db
    .update(castMembers)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(castMembers.id, id), eq(castMembers.workId, workId)))
    .returning({ id: castMembers.id });
  return rows.length > 0;
}

// Cenas da obra com uma fala desse personagem (busca no JSON dos blocos).
export async function countScenesWithSpeaker(workId: string, castId: string): Promise<number> {
  const needle = `"castId": ${JSON.stringify(castId)}`;
  const [row] = await db
    .select({ total: count() })
    .from(scenes)
    .where(and(eq(scenes.workId, workId), sql`position(${needle} in ${scenes.blocks}::text) > 0`));
  return row?.total ?? 0;
}

export async function deleteCastMember(workId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(castMembers)
    .where(and(eq(castMembers.id, id), eq(castMembers.workId, workId)))
    .returning({ id: castMembers.id });
  return rows.length > 0;
}

export async function reorderCast(workId: string, orderedIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [position, id] of orderedIds.entries()) {
      await tx.update(castMembers).set({ position }).where(and(eq(castMembers.id, id), eq(castMembers.workId, workId)));
    }
  });
}
