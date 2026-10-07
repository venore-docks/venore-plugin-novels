import { isSupportedLocale } from "../../../shared/locales";
import { isValidSlug } from "../../../shared/slug";
import type { CreateWorkInput } from "./types";

const MAX_SYNOPSIS = 4000;

export function isValidCoverFocus(focus: unknown): boolean {
  if (focus === null || focus === undefined) return true;
  if (typeof focus !== "object") return false;
  const { x, y } = focus as { x?: unknown; y?: unknown };
  return [x, y].every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100);
}

export function validateCreateWorkInput(input: CreateWorkInput): { code: string; message: string } | null {
  if (!input.title.trim()) return { code: "novels.invalid_title", message: "Informe o título da obra." };
  if (input.title.trim().length > 160) {
    return { code: "novels.invalid_title", message: "O título pode ter no máximo 160 caracteres." };
  }
  if ((input.subtitle ?? "").length > 160) {
    return { code: "novels.invalid_subtitle", message: "O subtítulo pode ter no máximo 160 caracteres." };
  }
  if ((input.synopsis ?? "").length > MAX_SYNOPSIS) {
    return { code: "novels.invalid_synopsis", message: `A sinopse pode ter no máximo ${MAX_SYNOPSIS} caracteres.` };
  }
  if (!isValidSlug(input.slug)) {
    return {
      code: "novels.invalid_slug",
      message: "Endereço inválido: use letras minúsculas, números e hífen (ex: a-ultima-cancao).",
    };
  }
  if (!isSupportedLocale(input.defaultLocale)) {
    return { code: "novels.invalid_locale", message: "Idioma principal não suportado." };
  }
  const locales = input.locales ?? [input.defaultLocale];
  if (!locales.every(isSupportedLocale) || new Set(locales).size !== locales.length || !locales.includes(input.defaultLocale)) {
    return { code: "novels.invalid_locale", message: "Idiomas inválidos: o principal precisa estar na lista, sem repetir." };
  }
  if (!isValidCoverFocus(input.coverFocus)) return { code: "novels.invalid_cover_focus", message: "Recorte da capa inválido." };
  return null;
}
