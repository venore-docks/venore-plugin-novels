import type { OperationResult } from "@venore/plugin-sdk";
import type { TagCatalog } from "../../../contracts/types";

// Dados do assistente de criação: o catálogo de tags para o passo "Tags".
export type NewWorkFormView = { tagCatalog: TagCatalog };
export type GetNewWorkFormResult = OperationResult<NewWorkFormView>;
