import type { OperationResult } from "@venore/plugin-sdk";
import type { WorkRecord } from "../../../contracts/types";

export type PublishWorkInput = { workId: string };
export type PublishWorkCommand = PublishWorkInput & { actorId: string };
export type PublishWorkResult = OperationResult<WorkRecord>;
