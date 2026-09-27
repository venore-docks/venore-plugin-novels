import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { chapters } from "../../../database/schema";

export { findChapterWithWork, findStoryRecords } from "../../../database/queries/story-records";

// Apaga e fecha o buraco na numeração (posições seguintes descem uma casa).
export async function deleteChapterAndCompact(chapterId: string, workId: string, position: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(chapters).where(eq(chapters.id, chapterId));
    await tx
      .update(chapters)
      .set({ position: sql`${chapters.position} - 1` })
      .where(and(eq(chapters.workId, workId), gt(chapters.position, position)));
  });
}
