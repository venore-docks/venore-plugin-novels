import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import type { CatalogBadges } from "../../../contracts/types";
import { TAG_SETTINGS_BADGES_KEY } from "../../../shared/tag-catalog";
import type { StarterGroup } from "../../../seeds/tag-starter-pack";
import { catalogSettings, tagGroups, tags } from "../../../database/schema";
import type { SaveTagGroupInput, SaveTagInput } from "./types";

export async function findGroupByKey(key: string) {
  const [row] = await db.select({ id: tagGroups.id }).from(tagGroups).where(eq(tagGroups.key, key)).limit(1);
  return row ?? null;
}

export async function findGroupById(id: string) {
  const [row] = await db.select({ id: tagGroups.id }).from(tagGroups).where(eq(tagGroups.id, id)).limit(1);
  return row ?? null;
}

export async function findTagBySlug(slug: string) {
  const [row] = await db.select({ id: tags.id }).from(tags).where(eq(tags.slug, slug)).limit(1);
  return row ?? null;
}

export async function findTagById(id: string) {
  const [row] = await db.select({ id: tags.id, groupId: tags.groupId, custom: tags.custom }).from(tags).where(eq(tags.id, id)).limit(1);
  return row ?? null;
}

const groupValues = (input: SaveTagGroupInput) => ({
  key: input.key,
  name: input.name,
  category: input.category,
  selection: input.selection,
  required: input.required,
  allowCustom: input.allowCustom,
  showOnCard: input.showOnCard,
});

export async function insertGroup(input: SaveTagGroupInput): Promise<string> {
  const [{ next }] = await db.select({ next: sql<number>`coalesce(max(${tagGroups.position}), -1)::int + 1` }).from(tagGroups);
  const [row] = await db.insert(tagGroups).values({ ...groupValues(input), position: next }).returning({ id: tagGroups.id });
  return row.id;
}

export async function updateGroup(id: string, input: SaveTagGroupInput): Promise<boolean> {
  const rows = await db.update(tagGroups).set({ ...groupValues(input), updatedAt: new Date() }).where(eq(tagGroups.id, id)).returning({ id: tagGroups.id });
  return rows.length > 0;
}

export async function setGroupArchived(id: string, archived: boolean): Promise<boolean> {
  const rows = await db
    .update(tagGroups)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(eq(tagGroups.id, id))
    .returning({ id: tagGroups.id });
  return rows.length > 0;
}

// Tags e o vínculo com as obras caem junto (ON DELETE CASCADE).
export async function deleteGroup(id: string): Promise<boolean> {
  const rows = await db.delete(tagGroups).where(eq(tagGroups.id, id)).returning({ id: tagGroups.id });
  return rows.length > 0;
}

export async function reorderGroups(orderedIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [position, id] of orderedIds.entries()) {
      await tx.update(tagGroups).set({ position, updatedAt: new Date() }).where(eq(tagGroups.id, id));
    }
  });
}

export async function insertTag(input: SaveTagInput, actorId: string): Promise<string> {
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${tags.position}), -1)::int + 1` })
    .from(tags)
    .where(and(eq(tags.groupId, input.groupId), eq(tags.custom, false)));
  const [row] = await db
    .insert(tags)
    .values({ groupId: input.groupId, slug: input.slug, name: input.name, description: input.description, position: next, createdByUserId: actorId })
    .returning({ id: tags.id });
  return row.id;
}

export async function updateTag(id: string, input: SaveTagInput): Promise<boolean> {
  const rows = await db
    .update(tags)
    .set({ groupId: input.groupId, slug: input.slug, name: input.name, description: input.description, updatedAt: new Date() })
    .where(eq(tags.id, id))
    .returning({ id: tags.id });
  return rows.length > 0;
}

export async function setTagArchived(id: string, archived: boolean): Promise<boolean> {
  const rows = await db
    .update(tags)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(eq(tags.id, id))
    .returning({ id: tags.id });
  return rows.length > 0;
}

export async function deleteTag(id: string): Promise<boolean> {
  const rows = await db.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });
  return rows.length > 0;
}

// Promover: a tag livre entra no catálogo oficial (aparece na seleção de todas as obras), no fim
// do grupo.
export async function promoteTag(id: string, groupId: string): Promise<void> {
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${tags.position}), -1)::int + 1` })
    .from(tags)
    .where(and(eq(tags.groupId, groupId), eq(tags.custom, false), ne(tags.id, id)));
  await db.update(tags).set({ custom: false, position: next, updatedAt: new Date() }).where(eq(tags.id, id));
}

export async function reorderTags(groupId: string, orderedIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [position, id] of orderedIds.entries()) {
      await tx.update(tags).set({ position, updatedAt: new Date() }).where(and(eq(tags.id, id), eq(tags.groupId, groupId)));
    }
  });
}

export async function upsertBadges(badges: CatalogBadges): Promise<void> {
  await db
    .insert(catalogSettings)
    .values({ key: TAG_SETTINGS_BADGES_KEY, value: badges, updatedAt: new Date() })
    .onConflictDoUpdate({ target: catalogSettings.key, set: { value: badges, updatedAt: new Date() } });
}

// Pacote inicial: só insere o que falta (grupo pela key, tag pelo slug) e os selos se não existem.
export async function installStarterPack(pack: StarterGroup[], badges: CatalogBadges): Promise<{ groups: number; tags: number }> {
  return db.transaction(async (tx) => {
    let groupCount = 0;
    let tagCount = 0;
    const existingGroups = await tx.select({ id: tagGroups.id, key: tagGroups.key }).from(tagGroups);
    const groupIdByKey = new Map(existingGroups.map((row) => [row.key, row.id]));
    const [{ next }] = await tx.select({ next: sql<number>`coalesce(max(${tagGroups.position}), -1)::int + 1` }).from(tagGroups);
    let position = next;
    const slugs = pack.flatMap((group) => group.tags.map((tag) => tag.slug));
    const existingSlugs = new Set(
      slugs.length > 0 ? (await tx.select({ slug: tags.slug }).from(tags).where(inArray(tags.slug, slugs))).map((row) => row.slug) : [],
    );
    for (const group of pack) {
      let groupId = groupIdByKey.get(group.key);
      if (!groupId) {
        const [row] = await tx
          .insert(tagGroups)
          .values({
            key: group.key,
            name: group.name,
            category: group.category,
            selection: group.selection,
            required: group.required,
            allowCustom: group.allowCustom,
            showOnCard: group.showOnCard,
            position: position++,
          })
          .returning({ id: tagGroups.id });
        groupId = row.id;
        groupCount += 1;
      }
      for (const [index, tag] of group.tags.entries()) {
        if (existingSlugs.has(tag.slug)) continue;
        await tx.insert(tags).values({ groupId, slug: tag.slug, name: tag.name, description: tag.description ?? {}, position: index });
        tagCount += 1;
      }
    }
    await tx.insert(catalogSettings).values({ key: TAG_SETTINGS_BADGES_KEY, value: badges }).onConflictDoNothing();
    return { groups: groupCount, tags: tagCount };
  });
}
