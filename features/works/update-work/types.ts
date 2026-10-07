import type { OperationResult } from "@venore/plugin-sdk";
import type { LocalizedText, VariableDefinition, WorkRecord, WorkTags } from "../../../contracts/types";

export type UpdateWorkInput = {
  workId: string;
  slug: string;
  title: LocalizedText;
  synopsis: LocalizedText;
  defaultLocale: string;
  locales: string[];
  coverMediaId: string | null;
  variables: VariableDefinition[];
  // Opcional: quem não manda tags (seed, chamadas antigas) mantém as que a obra já tem.
  tags?: WorkTags;
};
export type UpdateWorkCommand = UpdateWorkInput & { actorId: string };
export type UpdateWorkResult = OperationResult<WorkRecord>;
