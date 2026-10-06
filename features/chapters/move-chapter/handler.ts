import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { moveChapter } from "./service";
import type { MoveChapterInput, MoveChapterResult } from "./types";

export async function moveChapterHandler(input: MoveChapterInput): Promise<MoveChapterResult> {
  if (input.direction !== "up" && input.direction !== "down") {
    return { success: false, error: { code: "novels.invalid_direction", message: "Direção inválida." } };
  }
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return moveChapter({ ...input, actorId: authz.actorId });
}
