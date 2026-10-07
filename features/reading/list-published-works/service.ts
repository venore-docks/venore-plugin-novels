import { resolveMediaUrls } from "../../../shared/resolve-media-urls";
import { normalizeTags } from "../../../shared/tags";
import { findPublishedWorks } from "./store";
import type { ListPublishedWorksInput, ListPublishedWorksResult } from "./types";

const MAX_LIMIT = 100;

export async function listPublishedWorks(input: ListPublishedWorksInput = {}): Promise<ListPublishedWorksResult> {
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? MAX_LIMIT), 1), MAX_LIMIT);
  const rows = await findPublishedWorks(limit);
  const urls = await resolveMediaUrls(rows.flatMap((row) => (row.coverMediaId ? [row.coverMediaId] : [])));
  return {
    success: true,
    data: rows.map(({ coverMediaId, tags, interactive, ...row }) => ({
      ...row,
      tags: normalizeTags(tags),
      interactive: Boolean(interactive),
      coverUrl: coverMediaId ? (urls[coverMediaId] ?? null) : null,
    })),
  };
}
