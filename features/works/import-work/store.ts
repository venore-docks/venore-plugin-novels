import { inArray, like, or, eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { castMembers, chapters, choices, creatures, items, scenes, tags, works, workTags } from "../../../database/schema";
import { isWorkExampleKey, loadWorkExample } from "../../../examples";
import type { ImportedWork } from "../../../shared/work-package";

export async function findExamplePackage(key: string): Promise<unknown | null> {
  return isWorkExampleKey(key) ? loadWorkExample(key) : null;
}

export async function findTakenSlugs(base: string): Promise<string[]> {
  const rows = await db
    .select({ slug: works.slug })
    .from(works)
    .where(or(eq(works.slug, base), like(works.slug, `${base}-%`)));
  return rows.map((row) => row.slug);
}

export async function findTagIdsBySlugs(slugs: string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  const rows = await db.select({ id: tags.id }).from(tags).where(inArray(tags.slug, slugs));
  return rows.map((row) => row.id);
}

// Obra, elenco, catálogo, capítulos, cenas e escolhas numa transação: ou entra tudo, ou nada.
export async function insertImportedWork(imported: ImportedWork, context: { authorUserId: string; tagIds: string[] }): Promise<string> {
  return db.transaction(async (tx) => {
    const [work] = await tx
      .insert(works)
      .values({
        slug: imported.work.slug,
        title: imported.work.title,
        subtitle: imported.work.subtitle,
        synopsis: imported.work.synopsis,
        defaultLocale: imported.work.defaultLocale,
        locales: imported.work.locales,
        variables: imported.work.variables,
        gameSystem: imported.work.gameSystem,
        authorUserId: context.authorUserId,
      })
      .returning({ id: works.id });
    const workId = work.id;
    if (imported.cast.length > 0) await tx.insert(castMembers).values(imported.cast.map((member) => ({ ...member, workId })));
    if (imported.items.length > 0) await tx.insert(items).values(imported.items.map((item) => ({ ...item, workId })));
    if (imported.creatures.length > 0) await tx.insert(creatures).values(imported.creatures.map((creature) => ({ ...creature, workId })));
    for (const chapter of imported.chapters) {
      await tx.insert(chapters).values({ id: chapter.id, workId, position: chapter.position, title: chapter.title, startSceneId: chapter.graph.startSceneId });
      if (chapter.graph.scenes.length > 0) await tx.insert(scenes).values(chapter.graph.scenes.map((scene) => ({ ...scene, workId, chapterId: chapter.id })));
      if (chapter.graph.choices.length > 0) await tx.insert(choices).values(chapter.graph.choices);
    }
    if (context.tagIds.length > 0) await tx.insert(workTags).values(context.tagIds.map((tagId) => ({ workId, tagId })));
    return workId;
  });
}
