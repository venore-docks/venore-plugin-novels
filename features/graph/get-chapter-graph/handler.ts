import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { getChapterGraph } from "./service";
import type { GetChapterGraphInput, GetChapterGraphResult } from "./types";

export async function getChapterGraphHandler(input: GetChapterGraphInput): Promise<GetChapterGraphResult> {
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return getChapterGraph(input);
}
