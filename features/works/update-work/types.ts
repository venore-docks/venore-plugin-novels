import type { OperationResult } from "@venore/plugin-sdk";
import type { CoverFocus, LocalizedText, WorkRecord, WorkTagInput } from "../../../contracts/types";

// Aba "Configurações" da obra: identidade, idiomas e tags. Variáveis/sistema de jogo têm o próprio
// caso de uso (update-work-variables).
export type UpdateWorkInput = {
  workId: string;
  slug: string;
  title: LocalizedText;
  subtitle?: LocalizedText;
  synopsis: LocalizedText;
  defaultLocale: string;
  locales: string[];
  coverMediaId: string | null;
  coverFocus?: CoverFocus | null;
  // Opcional: quem não manda tags (seed, chamadas antigas) mantém as que a obra já tem.
  tags?: WorkTagInput;
};
export type UpdateWorkCommand = UpdateWorkInput & { actorId: string };
export type UpdateWorkResult = OperationResult<WorkRecord>;
