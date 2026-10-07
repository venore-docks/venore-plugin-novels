import type { OperationResult } from "@venore/plugin-sdk";
import type { TagCatalog } from "../../../contracts/types";

// Visão do admin: catálogo inteiro (arquivados e tags livres inclusos) e quantas obras usam cada tag.
export type TagCatalogAdminView = TagCatalog & { usage: Record<string, number> };
export type GetTagCatalogResult = OperationResult<TagCatalogAdminView>;
