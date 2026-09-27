import { findReaderProgress } from "./store";
import type { GetReaderProgressQuery, GetReaderProgressResult } from "./types";

export async function getReaderProgress(query: GetReaderProgressQuery): Promise<GetReaderProgressResult> {
  return { success: true, data: await findReaderProgress(query.userId, query.workId) };
}
