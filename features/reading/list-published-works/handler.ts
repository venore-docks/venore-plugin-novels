import { listPublishedWorks } from "./service";
import type { ListPublishedWorksInput, ListPublishedWorksResult } from "./types";

// Público de propósito: vitrine de obras publicadas, sem sessão.
export async function listPublishedWorksHandler(input: ListPublishedWorksInput = {}): Promise<ListPublishedWorksResult> {
  return listPublishedWorks(input);
}
