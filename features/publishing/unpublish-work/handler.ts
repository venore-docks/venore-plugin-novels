import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { unpublishWork } from "./service";
import type { UnpublishWorkInput, UnpublishWorkResult } from "./types";

export async function unpublishWorkHandler(input: UnpublishWorkInput): Promise<UnpublishWorkResult> {
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return unpublishWork({ ...input, actorId: authz.actorId });
}
