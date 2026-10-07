import { TAG_CATEGORIES, TAG_SELECTIONS, type LocalizedText } from "../../../contracts/types";
import { isValidSlug } from "../../../shared/slug";
import { MAX_TAG_DESCRIPTION, MAX_TAG_NAME } from "../../../shared/tag-catalog";
import type { SaveTagGroupInput, SaveTagInput } from "./types";

type ValidationError = { code: string; message: string } | null;

const hasName = (name: LocalizedText) => Object.values(name ?? {}).some((value) => typeof value === "string" && value.trim());
const tooLong = (text: LocalizedText, max: number) => Object.values(text ?? {}).some((value) => String(value).length > max);

export function validateTagGroupInput(input: SaveTagGroupInput): ValidationError {
  if (!isValidSlug(input.key)) {
    return { code: "novels.invalid_tag_group_key", message: "Chave do grupo inválida: use letras minúsculas, números e hífen." };
  }
  if (!hasName(input.name)) return { code: "novels.invalid_tag_group_name", message: "Dê um nome ao grupo." };
  if (tooLong(input.name, MAX_TAG_NAME)) {
    return { code: "novels.invalid_tag_group_name", message: `O nome do grupo pode ter até ${MAX_TAG_NAME} caracteres.` };
  }
  if (!TAG_CATEGORIES.includes(input.category) || !TAG_SELECTIONS.includes(input.selection)) {
    return { code: "novels.invalid_tag_group", message: "Categoria ou tipo de seleção inválido." };
  }
  return null;
}

export function validateTagInput(input: SaveTagInput): ValidationError {
  if (!input.groupId) return { code: "novels.invalid_tag_group", message: "Escolha o grupo da tag." };
  if (!isValidSlug(input.slug)) {
    return { code: "novels.invalid_tag_slug", message: "Endereço da tag inválido: use letras minúsculas, números e hífen." };
  }
  if (!hasName(input.name)) return { code: "novels.invalid_tag_name", message: "Dê um nome à tag." };
  if (tooLong(input.name, MAX_TAG_NAME)) {
    return { code: "novels.invalid_tag_name", message: `O nome da tag pode ter até ${MAX_TAG_NAME} caracteres.` };
  }
  if (tooLong(input.description, MAX_TAG_DESCRIPTION)) {
    return { code: "novels.invalid_tag_description", message: `A descrição pode ter até ${MAX_TAG_DESCRIPTION} caracteres.` };
  }
  return null;
}
