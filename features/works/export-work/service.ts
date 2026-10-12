import { packageFromRecords } from "../../../shared/work-package";
import { findStoryRecords, findWorkById, findWorkTagSlugs } from "./store";
import type { ExportWorkInput, ExportWorkResult } from "./types";

// Leitura pura (nada muda no banco): sem beginOperation, como o get-work.
export async function exportWork(input: ExportWorkInput): Promise<ExportWorkResult> {
  const work = await findWorkById(input.workId);
  if (!work) return { success: false, error: { code: "novels.work_not_found", message: "Obra não encontrada." } };
  const [records, tags] = await Promise.all([findStoryRecords(work), findWorkTagSlugs(work.id)]);
  const anyModule = Object.values(work.gameSystem.modules).some(Boolean);
  const pkg = packageFromRecords(records, { tags, kind: anyModule ? null : "narrative" });
  return { success: true, data: { fileName: `${work.slug}.venore-novel.json`, pkg } };
}
