import type { OperationResult } from "@venore/plugin-sdk";

export type ConvertLegacyVariablesInput = { workId: string };
export type ConvertLegacyVariablesCommand = ConvertLegacyVariablesInput & { actorId: string };
export type ConvertLegacyVariablesResult = OperationResult<{ resources: string[]; items: string[]; capacity: string | null }>;
