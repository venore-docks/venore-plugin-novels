
export { findStoryRecords, findWorkRowById as findWorkById } from "../../../database/queries/story-records";
export { upsertReaderProgress } from "../save-reader-progress/store";
import { findReaderStats } from "../save-reader-progress/store";

// Finais e conquistas de jornadas anteriores continuam valendo na nova.
export async function findCarriedProgress(userId: string, workId: string): Promise<{ visitedEndings: string[]; achievements: string[] }> {
  const stats = await findReaderStats(userId, workId);
  return { visitedEndings: stats?.endingsSeen ?? [], achievements: stats?.achievements ?? [] };
}
