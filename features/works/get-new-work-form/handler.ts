import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { getNewWorkForm } from "./service";
import type { GetNewWorkFormResult } from "./types";

export async function getNewWorkFormHandler(): Promise<GetNewWorkFormResult> {
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return getNewWorkForm();
}
