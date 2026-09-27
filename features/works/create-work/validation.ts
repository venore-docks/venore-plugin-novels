import { isSupportedLocale } from "../../../shared/locales";
import { isValidSlug } from "../../../shared/slug";
import type { CreateWorkInput } from "./types";

export function validateCreateWorkInput(input: CreateWorkInput): { code: string; message: string } | null {
  if (!input.title.trim()) return { code: "graphic-novels.invalid_title", message: "Informe o título da obra." };
  if (input.title.trim().length > 160) {
    return { code: "graphic-novels.invalid_title", message: "O título pode ter no máximo 160 caracteres." };
  }
  if (!isValidSlug(input.slug)) {
    return {
      code: "graphic-novels.invalid_slug",
      message: "Endereço inválido: use letras minúsculas, números e hífen (ex: a-ultima-cancao).",
    };
  }
  if (!isSupportedLocale(input.defaultLocale)) {
    return { code: "graphic-novels.invalid_locale", message: "Idioma principal não suportado." };
  }
  return null;
}
