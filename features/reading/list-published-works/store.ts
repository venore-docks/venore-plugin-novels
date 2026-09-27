import { desc, eq, sql } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { chapters, works } from "../../../database/schema";

export async function findPublishedWorks(limit: number) {
  return db
    .select({
      id: works.id,
      slug: works.slug,
      title: works.title,
      synopsis: works.synopsis,
      defaultLocale: works.defaultLocale,
      locales: works.locales,
      coverMediaId: works.coverMediaId,
      publishedAt: works.publishedAt,
      chapterCount: sql<number>`(select count(*)::int from ${chapters} where ${chapters.workId} = ${works.id})`,
    })
    .from(works)
    .where(eq(works.status, "published"))
    .orderBy(desc(works.publishedAt))
    .limit(limit);
}
