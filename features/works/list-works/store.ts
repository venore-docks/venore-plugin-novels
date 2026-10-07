import { desc, sql } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { works } from "../../../database/schema";
import { toWorkRecord } from "../../../database/queries/story-records";
import type { WorkRecord } from "../../../contracts/types";

export async function findAllWorksWithCounts(): Promise<(WorkRecord & { chapterCount: number; sceneCount: number })[]> {
  const rows = await db
    .select({
      work: works,
      // Nomes qualificados à mão: dentro de sql`` o Drizzle não prefixa a tabela, e "id" casava com
      // a própria subconsulta (contava sempre 0).
      chapterCount: sql<number>`(select count(*)::int from novels.chapters ch where ch.work_id = "novels"."works"."id")`,
      sceneCount: sql<number>`(select count(*)::int from novels.scenes sc where sc.work_id = "novels"."works"."id")`,
    })
    .from(works)
    .orderBy(desc(works.updatedAt));
  return rows.map((row) => ({ ...toWorkRecord(row.work), chapterCount: row.chapterCount, sceneCount: row.sceneCount }));
}

