import type { OperationResult } from "@venore/plugin-sdk";

export type DeleteWorkInput = { workId: string };
export type DeleteWorkCommand = DeleteWorkInput & { actorId: string };
export type DeleteWorkResult = OperationResult<{ id: string }>;
