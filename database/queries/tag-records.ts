import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import type { CatalogBadges, TagCatalog, TagGroupRecord, TagRecord, WorkTagInput } from "../../contracts/types";
import { normalizeBadges, TAG_SETTINGS_BADGES_KEY, uniqueTagSlug } from "../../shared/tag-catalog";
import { catalogSettings, tagGroups, tags, workTags } from "../schema";

// Leituras e escritas do catálogo de tags compartilhadas entre casos de uso (obra, catálogo
// público, leitor). Mesmo racional de story-records.ts.

type Executor = Pick<typeof db, "select" | "insert" | "delete" | "update">;

function toGroup(row: typeof tagGroups.$inferSelect): TagGroupRecord {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    category: row.category === "production" ? "production" : "info",
    selection: row.selection === "single" ? "single" : "multiple",
    required: row.required,
    allowCustom: row.allowCustom,
    showOnCard: row.showOnCard,
    position: row.position,
    archivedAt: row.archivedAt,
  };
}

function toTag(row: typeof tags.$inferSelect): TagRecord {
  return {
    id: row.id,
    groupId: row.groupId,
    slug: row.slug,
    name: row.name,
    description: row.description,
    position: row.position,
    custom: row.custom,
    archivedAt: row.archivedAt,
  };
}

export async function findBadges(executor: Executor = db): Promise<CatalogBadges> {
  const [row] = await executor.select().from(catalogSettings).where(eq(catalogSettings.key, TAG_SETTINGS_BADGES_KEY)).limit(1);
  return normalizeBadges(row?.value);
}

export async function findTagCatalog(executor: Executor = db): Promise<TagCatalog> {
  const [groupRows, tagRows, badges] = await Promise.all([
    executor.select().from(tagGroups).orderBy(asc(tagGroups.position), asc(tagGroups.createdAt)),
    executor.select().from(tags).orderBy(asc(tags.position), asc(tags.slug)),
    findBadges(executor),
  ]);
  return { groups: groupRows.map(toGroup), tags: tagRows.map(toTag), badges };
}

export async function findWorkTagIds(workId: string, executor: Executor = db): Promise<string[]> {
  const rows = await executor.select({ tagId: workTags.tagId }).from(workTags).where(eq(workTags.workId, workId));
  return rows.map((row) => row.tagId);
}

export async function findTagIdsByWork(workIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (workIds.length === 0) return map;
  const rows = await db.select().from(workTags).where(inArray(workTags.workId, workIds));
  for (const row of rows) map.set(row.workId, [...(map.get(row.workId) ?? []), row.tagId]);
  return map;
}

// Grava as tags da obra (já normalizadas por shared/tag-catalog.ts): cria as tags livres novas no
// grupo (custom = true, só desta obra até o admin promover) e troca a lista da obra.
export async function replaceWorkTags(
  executor: Executor,
  workId: string,
  input: WorkTagInput,
  context: { actorId: string; locale: string },
): Promise<string[]> {
  const ids = [...input.tagIds];
  if (input.newTags.length > 0) {
    const taken = new Set((await executor.select({ slug: tags.slug }).from(tags)).map((row) => row.slug));
    for (const candidate of input.newTags) {
      const slug = uniqueTagSlug(candidate.name, taken);
      taken.add(slug);
      const [row] = await executor
        .insert(tags)
        .values({
          groupId: candidate.groupId,
          slug,
          name: { [context.locale]: candidate.name },
          custom: true,
          createdByUserId: context.actorId,
          position: 1000,
        })
        .returning({ id: tags.id });
      ids.push(row.id);
    }
  }
  const unique = [...new Set(ids)];
  await executor
    .delete(workTags)
    .where(unique.length > 0 ? and(eq(workTags.workId, workId), notInArray(workTags.tagId, unique)) : eq(workTags.workId, workId));
  if (unique.length > 0) {
    await executor.insert(workTags).values(unique.map((tagId) => ({ workId, tagId }))).onConflictDoNothing();
  }
  return unique;
}
