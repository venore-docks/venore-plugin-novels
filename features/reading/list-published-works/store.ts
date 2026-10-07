import { desc, eq, sql } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { works } from "../../../database/schema";

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
      chapterCount: sql<number>`(select count(*)::int from novels.chapters ch where ch.work_id = "novels"."works"."id")`,
      tags: works.tags,
      // Nomes qualificados à mão: dentro de sql`` o Drizzle não prefixa a tabela, e "id" ficaria
      // ambíguo entre works, scenes e choices.
      interactive: sql<boolean>`exists (
        select 1 from novels.choices c inner join novels.scenes s on s.id = c.scene_id
        where s.work_id = "novels"."works"."id"
        group by c.scene_id having count(*) > 1
      )`,
    })
    .from(works)
    .where(eq(works.status, "published"))
    .orderBy(desc(works.publishedAt))
    .limit(limit);
}
