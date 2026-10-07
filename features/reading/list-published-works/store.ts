import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { tags, workTags, works } from "../../../database/schema";

export { findTagCatalog, findTagIdsByWork } from "../../../database/queries/tag-records";

export async function findTagBySlug(slug: string) {
  const [row] = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
  return row ?? null;
}

export async function findPublishedWorks(limit: number, tagId: string | null) {
  const filter = tagId
    ? and(eq(works.status, "published"), inArray(works.id, db.select({ id: workTags.workId }).from(workTags).where(eq(workTags.tagId, tagId))))
    : eq(works.status, "published");
  return db
    .select({
      id: works.id,
      slug: works.slug,
      title: works.title,
      subtitle: works.subtitle,
      synopsis: works.synopsis,
      defaultLocale: works.defaultLocale,
      locales: works.locales,
      coverMediaId: works.coverMediaId,
      coverFocus: works.coverFocus,
      publishedAt: works.publishedAt,
      chapterCount: sql<number>`(select count(*)::int from novels.chapters ch where ch.work_id = "novels"."works"."id")`,
      // Nomes qualificados à mão: dentro de sql`` o Drizzle não prefixa a tabela, e "id" ficaria
      // ambíguo entre works, scenes e choices.
      interactive: sql<boolean>`exists (
        select 1 from novels.choices c inner join novels.scenes s on s.id = c.scene_id
        where s.work_id = "novels"."works"."id"
        group by c.scene_id having count(*) > 1
      )`,
    })
    .from(works)
    .where(filter)
    .orderBy(desc(works.publishedAt))
    .limit(limit);
}
