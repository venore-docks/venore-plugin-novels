import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import { publishWork } from "./service";
import type { PublishWorkInput, PublishWorkResult } from "./types";

export async function publishWorkHandler(input: PublishWorkInput): Promise<PublishWorkResult> {
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return publishWork({ ...input, actorId: authz.actorId });
}
