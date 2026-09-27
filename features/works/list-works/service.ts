import { resolveMediaUrls } from "../../../shared/resolve-media-urls";
import { findAllWorksWithCounts } from "./store";
import type { ListWorksResult } from "./types";

export async function listWorks(): Promise<ListWorksResult> {
  const rows = await findAllWorksWithCounts();
  const urls = await resolveMediaUrls(rows.flatMap((row) => (row.coverMediaId ? [row.coverMediaId] : [])));
  return {
    success: true,
    data: rows.map((row) => ({ ...row, coverUrl: row.coverMediaId ? (urls[row.coverMediaId] ?? null) : null })),
  };
}
