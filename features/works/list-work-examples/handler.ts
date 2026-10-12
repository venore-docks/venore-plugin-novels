import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { listWorkExamples } from "./service";
import type { ListWorkExamplesResult } from "./types";

export async function listWorkExamplesHandler(): Promise<ListWorkExamplesResult> {
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return listWorkExamples();
}
