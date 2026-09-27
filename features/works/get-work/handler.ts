import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { getWork } from "./service";
import type { GetWorkInput, GetWorkResult } from "./types";

export async function getWorkHandler(input: GetWorkInput): Promise<GetWorkResult> {
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return getWork(input);
}
