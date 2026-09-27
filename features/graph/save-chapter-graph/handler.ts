import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { parseChapterGraph } from "../../../shared/graph-schema";
import { saveChapterGraph } from "./service";
import type { SaveChapterGraphInput, SaveChapterGraphResult } from "./types";

export async function saveChapterGraphHandler(input: SaveChapterGraphInput): Promise<SaveChapterGraphResult> {
  const parsed = parseChapterGraph(input.graph);
  if (!parsed.ok) return { success: false, error: { code: "graphic-novels.invalid_graph", message: parsed.message } };

  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };

  return saveChapterGraph({ workId: input.workId, chapterId: input.chapterId, graph: parsed.graph, actorId: authz.actorId });
}
