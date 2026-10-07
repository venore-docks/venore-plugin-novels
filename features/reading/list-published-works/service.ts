import { resolveMediaUrls } from "../../../shared/resolve-media-urls";
import { isValidSlug } from "../../../shared/slug";
import { describeWorkTags } from "../../../shared/tag-catalog";
import { findPublishedWorks, findTagBySlug, findTagCatalog, findTagIdsByWork } from "./store";
import type { ListPublishedWorksInput, ListPublishedWorksResult } from "./types";

const MAX_LIMIT = 100;

export async function listPublishedWorks(input: ListPublishedWorksInput = {}): Promise<ListPublishedWorksResult> {
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? MAX_LIMIT), 1), MAX_LIMIT);
  const tagRow = input.tag && isValidSlug(input.tag) ? await findTagBySlug(input.tag) : null;
  // Filtro por tag que não existe: lista vazia (a página diz que não achou), nunca o catálogo todo.
  const rows = input.tag && !tagRow ? [] : await findPublishedWorks(limit, tagRow?.id ?? null);
  const [catalog, tagIdsByWork, urls] = await Promise.all([
    findTagCatalog(),
    findTagIdsByWork(rows.map((row) => row.id)),
    resolveMediaUrls(rows.flatMap((row) => (row.coverMediaId ? [row.coverMediaId] : []))),
  ]);
  return {
    success: true,
    data: {
      badges: catalog.badges,
      tag: tagRow
        ? { ...tagRow, archivedAt: tagRow.archivedAt ?? null }
        : null,
      works: rows.map(({ coverMediaId, interactive, ...row }) => ({
        ...row,
        coverFocus: row.coverFocus ?? null,
        tags: describeWorkTags(catalog, tagIdsByWork.get(row.id) ?? []).filter((group) => group.showOnCard),
        interactive: Boolean(interactive),
        coverUrl: coverMediaId ? (urls[coverMediaId] ?? null) : null,
      })),
    },
  };
}
