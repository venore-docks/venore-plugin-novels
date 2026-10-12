import type { OperationResult } from "@venore/plugin-sdk";
import type { LocalizedText } from "../../../contracts/types";

// Importar obra (0.15.0): um pacote venore-novels-work vira um rascunho novo, com ids novos.
// A origem é o arquivo enviado pelo autor ou uma das histórias de exemplo (examples/).
export type ImportWorkInput = { source: { kind: "file"; content: string } | { kind: "example"; key: string } };
export type ImportWorkCommand = ImportWorkInput & { actorId: string };

export type ImportWorkSummary = {
  workId: string;
  slug: string;
  title: LocalizedText;
  chapters: number;
  scenes: number;
  // O que o validador de publicação diz do rascunho importado.
  errors: number;
  warnings: number;
  firstIssues: string[];
};
export type ImportWorkResult = OperationResult<ImportWorkSummary>;
