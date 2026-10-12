import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { updateGameSystem } from "./service";
import type { UpdateGameSystemInput, UpdateGameSystemResult } from "./types";

// Sistema completo vira JSON de no máximo ~200 KB: o resto é ruído ou abuso.
const MAX_SYSTEM_CHARS = 200_000;

export async function updateGameSystemHandler(input: UpdateGameSystemInput): Promise<UpdateGameSystemResult> {
  if (!input.workId || typeof input.workId !== "string") {
    return { success: false, error: { code: "novels.invalid_work", message: "Obra não informada." } };
  }
  if (!input.system || typeof input.system !== "object" || JSON.stringify(input.system).length > MAX_SYSTEM_CHARS) {
    return { success: false, error: { code: "novels.invalid_system", message: "Sistema de jogo inválido ou grande demais." } };
  }
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return updateGameSystem({ ...input, actorId: authz.actorId });
}
