import type { OperationResult } from "@venore/plugin-sdk";
import type { CoverFocus, WorkRecord, WorkTagInput } from "../../../contracts/types";

// Assistente de criação (0.9.0): identidade, idiomas e tags de uma vez. Só título, endereço e
// idioma principal são obrigatórios (o seed e chamadas antigas mandam só isso).
export type CreateWorkInput = {
  title: string;
  slug: string;
  defaultLocale: string;
  subtitle?: string;
  synopsis?: string;
  locales?: string[];
  coverMediaId?: string | null;
  coverFocus?: CoverFocus | null;
  tags?: WorkTagInput;
};
export type CreateWorkCommand = CreateWorkInput & { actorId: string };
// firstChapterId: o assistente leva direto ao editor do primeiro capítulo.
export type CreateWorkResult = OperationResult<WorkRecord & { firstChapterId: string }>;
