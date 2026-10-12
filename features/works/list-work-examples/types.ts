import type { OperationResult } from "@venore/plugin-sdk";
import type { LocalizedText } from "../../../contracts/types";

// Histórias de exemplo para a tela de importação: um cartão por tipo de obra.
export type WorkExampleCard = {
  key: string;
  kind: string;
  title: LocalizedText;
  synopsis: LocalizedText;
  chapters: number;
  scenes: number;
  endings: number;
};
export type ListWorkExamplesResult = OperationResult<WorkExampleCard[]>;
