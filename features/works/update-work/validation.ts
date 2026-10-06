import { isSupportedLocale } from "../../../shared/locales";
import { isValidSlug } from "../../../shared/slug";
import { validateVariableDefinitions } from "../../../shared/story-validation";
import type { UpdateWorkInput } from "./types";

const MAX_VARIABLES = 50;
const MAX_SYNOPSIS = 4000;

export function validateUpdateWorkInput(input: UpdateWorkInput): { code: string; message: string } | null {
  if (!input.workId) return { code: "novels.invalid_work", message: "Obra não informada." };
  if (!isValidSlug(input.slug)) {
    return { code: "novels.invalid_slug", message: "Endereço inválido: use letras minúsculas, números e hífen." };
  }
  if (input.locales.length === 0 || !input.locales.every(isSupportedLocale)) {
    return { code: "novels.invalid_locale", message: "Escolha pelo menos um idioma suportado." };
  }
  if (new Set(input.locales).size !== input.locales.length) {
    return { code: "novels.invalid_locale", message: "Idioma repetido na lista." };
  }
  if (!input.locales.includes(input.defaultLocale)) {
    return { code: "novels.invalid_locale", message: "O idioma principal precisa estar entre os idiomas da obra." };
  }
  if (!input.title[input.defaultLocale]?.trim()) {
    return { code: "novels.invalid_title", message: "Informe o título no idioma principal." };
  }
  if (Object.values(input.title).some((value) => value.length > 160)) {
    return { code: "novels.invalid_title", message: "O título pode ter no máximo 160 caracteres." };
  }
  if (Object.values(input.synopsis).some((value) => value.length > MAX_SYNOPSIS)) {
    return { code: "novels.invalid_synopsis", message: `A sinopse pode ter no máximo ${MAX_SYNOPSIS} caracteres.` };
  }
  if (input.variables.length > MAX_VARIABLES) {
    return { code: "novels.too_many_variables", message: `No máximo ${MAX_VARIABLES} variáveis por obra.` };
  }
  const variableIssue = validateVariableDefinitions(input.variables)[0];
  if (variableIssue) return { code: `novels.${variableIssue.code}`, message: variableIssue.message };
  return null;
}
