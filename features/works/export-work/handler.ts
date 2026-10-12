import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { exportWork } from "./service";
import type { ExportWorkInput, ExportWorkResult } from "./types";

export async function exportWorkHandler(input: ExportWorkInput): Promise<ExportWorkResult> {
  if (typeof input?.workId !== "string" || !input.workId) return { success: false, error: { code: "novels.invalid_input", message: "Obra inválida." } };
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return exportWork(input);
}
