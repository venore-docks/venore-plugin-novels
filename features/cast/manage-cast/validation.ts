import { ACCENT_COLORS } from "../../../contracts/types";
import type { SaveCastMemberInput } from "./types";

export const MAX_CAST = 60;

export function validateCastMemberInput(input: SaveCastMemberInput): { code: string; message: string } | null {
  if (!input.workId) return { code: "novels.invalid_work", message: "Obra não informada." };
  const names = Object.values(input.name ?? {});
  if (!names.some((value) => typeof value === "string" && value.trim())) {
    return { code: "novels.invalid_cast_name", message: "Dê um nome ao personagem." };
  }
  if (names.some((value) => String(value).length > 60)) {
    return { code: "novels.invalid_cast_name", message: "O nome pode ter até 60 caracteres." };
  }
  if (!ACCENT_COLORS.includes(input.color)) return { code: "novels.invalid_cast_color", message: "Cor inválida." };
  return null;
}
