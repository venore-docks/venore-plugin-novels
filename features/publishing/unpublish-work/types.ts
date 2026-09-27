import type { OperationResult } from "@venore/plugin-sdk";
import type { WorkRecord } from "../../../contracts/types";

export type UnpublishWorkInput = { workId: string };
export type UnpublishWorkCommand = UnpublishWorkInput & { actorId: string };
export type UnpublishWorkResult = OperationResult<WorkRecord>;
