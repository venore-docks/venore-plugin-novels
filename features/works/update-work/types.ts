import type { OperationResult } from "@venore/plugin-sdk";
import type { LocalizedText, VariableDefinition, WorkRecord } from "../../../contracts/types";

export type UpdateWorkInput = {
  workId: string;
  slug: string;
  title: LocalizedText;
  synopsis: LocalizedText;
  defaultLocale: string;
  locales: string[];
  coverMediaId: string | null;
  variables: VariableDefinition[];
};
export type UpdateWorkCommand = UpdateWorkInput & { actorId: string };
export type UpdateWorkResult = OperationResult<WorkRecord>;
