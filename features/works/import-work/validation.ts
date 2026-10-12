import { WORK_PACKAGE_LIMITS } from "../../../shared/work-package";
import type { ImportWorkInput } from "./types";

export function validateImportWorkInput(input: ImportWorkInput): { code: string; message: string } | null {
  const source = input?.source;
  if (source?.kind === "file") {
    if (typeof source.content !== "string" || !source.content.trim()) return { code: "novels.invalid_input", message: "Escolha um arquivo .json de obra." };
    if (source.content.length > WORK_PACKAGE_LIMITS.chars) return { code: "novels.invalid_input", message: "Arquivo grande demais para uma obra." };
    return null;
  }
  if (source?.kind === "example" && typeof source.key === "string" && source.key.length <= 40) return null;
  return { code: "novels.invalid_input", message: "Origem da importação inválida." };
}
