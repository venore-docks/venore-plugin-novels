import type {
  CatalogBadges,
  LocalizedText,
  TagGroupRecord,
  TagRecord,
  WorkTagGroupView,
  WorkTagInput,
} from "../contracts/types";
import { slugify } from "./slug";

// Regras puras do catálogo de tags (0.9.0): o que uma obra pode escolher, o que mostrar ao leitor
// e o que falta para publicar. O catálogo em si (grupos, tags, textos dos selos) é dado do banco.

export const MAX_CUSTOM_TAGS_PER_GROUP = 5;
export const MAX_TAG_NAME = 40;
export const MAX_TAG_DESCRIPTION = 200;
export const TAG_SETTINGS_BADGES_KEY = "badges";

export const EMPTY_BADGES: CatalogBadges = { interactive: {}, textOnly: {}, aiAudio: {} };

export function cleanTagName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_NAME);
}

// Normaliza a escolha vinda do formulário contra o catálogo atual:
// - tag de grupo arquivado, de outro catálogo ou arquivada só fica se a obra já tinha;
// - tag livre (custom) só fica se a obra já tinha (escolher uma nova é por nome, em newTags);
// - grupo de uma opção guarda só a última;
// - tag livre nova só em grupo que aceita, sem repetir nome (ignora maiúsculas) e no limite.
export function normalizeWorkTagInput(
  catalog: { groups: TagGroupRecord[]; tags: TagRecord[] },
  input: WorkTagInput,
  currentTagIds: string[],
): WorkTagInput {
  const groups = new Map(catalog.groups.map((group) => [group.id, group]));
  const tags = new Map(catalog.tags.map((tag) => [tag.id, tag]));
  const current = new Set(currentTagIds);
  const chosenByGroup = new Map<string, string[]>();

  for (const tagId of input.tagIds ?? []) {
    const tag = tags.get(tagId);
    const group = tag ? groups.get(tag.groupId) : undefined;
    if (!tag || !group) continue;
    const available = !tag.archivedAt && !group.archivedAt && !tag.custom;
    if (!available && !current.has(tag.id)) continue;
    const list = chosenByGroup.get(group.id) ?? [];
    if (list.includes(tag.id)) continue;
    chosenByGroup.set(group.id, group.selection === "single" ? [tag.id] : [...list, tag.id]);
  }

  const newTags: WorkTagInput["newTags"] = [];
  for (const candidate of input.newTags ?? []) {
    const group = groups.get(candidate.groupId);
    const name = cleanTagName(String(candidate.name ?? ""));
    if (!group || group.archivedAt || !group.allowCustom || !name || !slugify(name)) continue;
    const chosen = chosenByGroup.get(group.id) ?? [];
    // Nome igual a uma tag que já existe no grupo: usa a existente.
    const existing = catalog.tags.find(
      (tag) => tag.groupId === group.id && Object.values(tag.name).some((value) => value.toLowerCase() === name.toLowerCase()),
    );
    if (existing && (!existing.archivedAt || current.has(existing.id))) {
      if (!chosen.includes(existing.id)) chosenByGroup.set(group.id, group.selection === "single" ? [existing.id] : [...chosen, existing.id]);
      continue;
    }
    const sameGroupNew = newTags.filter((tag) => tag.groupId === group.id);
    if (sameGroupNew.some((tag) => tag.name.toLowerCase() === name.toLowerCase())) continue;
    if (sameGroupNew.length >= MAX_CUSTOM_TAGS_PER_GROUP) continue;
    if (group.selection === "single") {
      chosenByGroup.set(group.id, []);
      for (let index = newTags.length - 1; index >= 0; index -= 1) if (newTags[index].groupId === group.id) newTags.splice(index, 1);
    }
    newTags.push({ groupId: group.id, name });
  }

  return { tagIds: [...chosenByGroup.values()].flat(), newTags };
}

// Slug único para uma tag livre nova: o do nome, ou com sufixo numérico se já existe.
export function uniqueTagSlug(name: string, taken: Set<string>): string {
  const base = slugify(name) || "tag";
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`.slice(0, 80);
    if (!taken.has(candidate)) return candidate;
  }
}

// Tags da obra em grupos, na ordem do catálogo (grupo e tag). Grupo arquivado continua aparecendo
// nas obras que já usam (some só da seleção).
export function describeWorkTags(catalog: { groups: TagGroupRecord[]; tags: TagRecord[] }, tagIds: string[]): WorkTagGroupView[] {
  const selected = new Set(tagIds);
  return [...catalog.groups]
    .sort((a, b) => a.position - b.position)
    .map((group) => ({
      id: group.id,
      key: group.key,
      name: group.name,
      category: group.category,
      showOnCard: group.showOnCard,
      tags: catalog.tags
        .filter((tag) => tag.groupId === group.id && selected.has(tag.id))
        .sort((a, b) => a.position - b.position || a.slug.localeCompare(b.slug))
        .map((tag) => ({ id: tag.id, slug: tag.slug, name: tag.name, description: tag.description })),
    }))
    .filter((group) => group.tags.length > 0);
}

export type TagIssue = { code: string; message: string; groupId: string };

// Grupo obrigatório sem escolha impede publicar.
export function validateWorkTags(groups: TagGroupRecord[], tags: TagRecord[], tagIds: string[], locale = "pt-BR"): TagIssue[] {
  const selected = new Set(tagIds);
  const chosenGroups = new Set(tags.filter((tag) => selected.has(tag.id)).map((tag) => tag.groupId));
  return groups
    .filter((group) => group.required && !group.archivedAt && !chosenGroups.has(group.id))
    .sort((a, b) => a.position - b.position)
    .map((group) => ({
      code: "missing_required_tag",
      message: `Escolha uma tag em "${group.name[locale] || Object.values(group.name)[0] || group.key}".`,
      groupId: group.id,
    }));
}

// Selos calculados que aparecem junto das tags (texto vem de configuração).
export function computedBadges(
  badges: CatalogBadges,
  context: { interactive: boolean; hasAudio: boolean },
): LocalizedText[] {
  const list: LocalizedText[] = [context.interactive ? badges.interactive : badges.textOnly];
  if (context.hasAudio) list.push(badges.aiAudio);
  return list.filter((text) => Object.values(text).some((value) => value.trim()));
}

export function normalizeBadges(raw: unknown): CatalogBadges {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (input: unknown): LocalizedText => {
    if (!input || typeof input !== "object") return {};
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  };
  return { interactive: text(value.interactive), textOnly: text(value.textOnly), aiAudio: text(value.aiAudio) };
}
