import { desc, sql } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { chapters, scenes, works } from "../../../database/schema";
import { toWorkRecord } from "../../../database/queries/story-records";
import type { WorkRecord } from "../../../contracts/types";

export async function findAllWorksWithCounts(): Promise<(WorkRecord & { chapterCount: number; sceneCount: number })[]> {
  const rows = await db
    .select({
      work: works,
      chapterCount: sql<number>`(select count(*)::int from ${chapters} where ${chapters.workId} = ${works.id})`,
      sceneCount: sql<number>`(select count(*)::int from ${scenes} where ${scenes.workId} = ${works.id})`,
    })
    .from(works)
    .orderBy(desc(works.updatedAt));
  return rows.map((row) => ({ ...toWorkRecord(row.work), chapterCount: row.chapterCount, sceneCount: row.sceneCount }));
}

