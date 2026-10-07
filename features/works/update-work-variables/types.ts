import type { OperationResult } from "@venore/plugin-sdk";
import type { VariableDefinition, WorkRecord } from "../../../contracts/types";

export type UpdateWorkVariablesInput = { workId: string; variables: VariableDefinition[] };
export type UpdateWorkVariablesCommand = UpdateWorkVariablesInput & { actorId: string };
export type UpdateWorkVariablesResult = OperationResult<WorkRecord>;
