import { eq, sql } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { chapters, works } from "../../../database/schema";
import type { ChapterRecord, LocalizedText } from "../../../contracts/types";

export { findWorkRowById as findWorkById } from "../../../database/queries/story-records";

export async function insertChapterAtEnd(workId: string, title: LocalizedText): Promise<ChapterRecord> {
  return db.transaction(async (tx) => {
    const [{ maxPosition }] = await tx
      .select({ maxPosition: sql<number>`coalesce(max(${chapters.position}), 0)::int` })
      .from(chapters)
      .where(eq(chapters.workId, workId));
    const [row] = await tx.insert(chapters).values({ workId, position: maxPosition + 1, title }).returning();
    await tx.update(works).set({ updatedAt: new Date() }).where(eq(works.id, workId));
    return row;
  });
}
