import type { OperationResult } from "@venore/plugin-sdk";
import type { VariableValue } from "../../../contracts/types";

export type GetSeriesCarryInput = { workId: string };
export type GetSeriesCarryResult = OperationResult<Record<string, VariableValue>>;
