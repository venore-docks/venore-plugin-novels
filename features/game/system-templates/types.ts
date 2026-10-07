import type { OperationResult } from "@venore/plugin-sdk";
import type { LocalizedText } from "../../../contracts/types";
import type { SystemTemplateRecord } from "../../../contracts/game";

export type ListSystemTemplatesResult = OperationResult<SystemTemplateRecord[]>;

// Importar um pacote (arquivo JSON) para a lista de modelos da instância.
export type ImportSystemTemplateInput = { package: unknown };
// Salvar o sistema de uma obra como modelo.
export type SaveWorkAsTemplateInput = { workId: string; key: string; name: LocalizedText; description: LocalizedText };
export type DeleteSystemTemplateInput = { id: string };
// Aplicar um modelo (da lista) ou um pacote (arquivo exportado de outra obra) numa obra.
export type ApplySystemTemplateInput = { workId: string; templateKey?: string | null; package?: unknown };

export type WithActor<T> = T & { actorId: string };
export type TemplateSavedResult = OperationResult<{ id: string; key: string }>;
export type TemplateVoidResult = OperationResult<null>;
export type ApplySystemTemplateResult = OperationResult<{ items: number; creatures: number }>;
