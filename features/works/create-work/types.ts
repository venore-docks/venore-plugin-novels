import type { OperationResult } from "@venore/plugin-sdk";
import type { WorkRecord } from "../../../contracts/types";

export type CreateWorkInput = { title: string; slug: string; defaultLocale: string };
export type CreateWorkCommand = CreateWorkInput & { actorId: string };
export type CreateWorkResult = OperationResult<WorkRecord>;
