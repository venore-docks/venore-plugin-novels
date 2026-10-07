import { findTagCatalog } from "./store";
import type { GetNewWorkFormResult } from "./types";

export async function getNewWorkForm(): Promise<GetNewWorkFormResult> {
  return { success: true, data: { tagCatalog: await findTagCatalog() } };
}
