import { describe, expect, it } from "vitest";
import type { TagGroupRecord, TagRecord } from "../contracts/types";
import { computedBadges, describeWorkTags, normalizeWorkTagInput, uniqueTagSlug, validateWorkTags } from "./tag-catalog";

const group = (id: string, patch: Partial<TagGroupRecord> = {}): TagGroupRecord => ({
  id,
  key: id,
  name: { "pt-BR": id },
  category: "info",
  selection: "multiple",
  required: false,
  allowCustom: false,
  showOnCard: false,
  position: 0,
  archivedAt: null,
  ...patch,
});
const tag = (id: string, groupId: string, patch: Partial<TagRecord> = {}): TagRecord => ({
  id,
  groupId,
  slug: id,
  name: { "pt-BR": id },
  description: {},
  position: 0,
  custom: false,
  archivedAt: null,
  ...patch,
});

const catalog = {
  groups: [
    group("genero", { allowCustom: true, position: 0 }),
    group("classificacao", { selection: "single", required: true, position: 1 }),
    group("velho", { archivedAt: new Date(), position: 2 }),
  ],
  tags: [
    tag("terror", "genero", { name: { "pt-BR": "Terror", en: "Horror" } }),
    tag("aventura", "genero", { position: 1 }),
    tag("livre", "classificacao"),
    tag("18", "classificacao"),
    tag("arquivada", "genero", { archivedAt: new Date() }),
    tag("tibia", "genero", { custom: true }),
    tag("x", "velho"),
  ],
};

describe("normalizeWorkTagInput", () => {
  it("descarta tag desconhecida, arquivada nova e livre de outra obra; grupo de uma opção guarda a última", () => {
    const result = normalizeWorkTagInput(catalog, { tagIds: ["terror", "nada", "arquivada", "tibia", "livre", "18", "x"], newTags: [] }, []);
    expect(result.tagIds).toEqual(["terror", "18"]);
  });

  it("mantém o que a obra já tinha, mesmo arquivado", () => {
    const result = normalizeWorkTagInput(catalog, { tagIds: ["arquivada", "tibia", "x"], newTags: [] }, ["arquivada", "tibia", "x"]);
    expect(result.tagIds.sort()).toEqual(["arquivada", "tibia", "x"]);
  });

  it("tag livre: só em grupo que aceita, sem repetir e reaproveitando a existente pelo nome", () => {
    const result = normalizeWorkTagInput(
      catalog,
      {
        tagIds: [],
        newTags: [
          { groupId: "genero", name: "  Space   opera " },
          { groupId: "genero", name: "space opera" },
          { groupId: "genero", name: "horror" },
          { groupId: "classificacao", name: "Adulto" },
          { groupId: "genero", name: "!!!" },
        ],
      },
      [],
    );
    expect(result.newTags).toEqual([{ groupId: "genero", name: "Space opera" }]);
    expect(result.tagIds).toEqual(["terror"]);
  });
});

describe("catálogo", () => {
  it("slug único com sufixo", () => {
    expect(uniqueTagSlug("Ação RPG", new Set())).toBe("acao-rpg");
    expect(uniqueTagSlug("Ação RPG", new Set(["acao-rpg", "acao-rpg-2"]))).toBe("acao-rpg-3");
  });

  it("tags da obra em grupos, na ordem do catálogo", () => {
    const groups = describeWorkTags(catalog, ["livre", "aventura", "terror"]);
    expect(groups.map((entry) => [entry.key, entry.tags.map((item) => item.slug)])).toEqual([
      ["genero", ["terror", "aventura"]],
      ["classificacao", ["livre"]],
    ]);
  });

  it("grupo obrigatório sem escolha vira problema de publicação", () => {
    expect(validateWorkTags(catalog.groups, catalog.tags, ["terror"]).map((issue) => issue.groupId)).toEqual(["classificacao"]);
    expect(validateWorkTags(catalog.groups, catalog.tags, ["livre"])).toEqual([]);
  });

  it("selos calculados com texto vazio não aparecem", () => {
    const badges = { interactive: { "pt-BR": "Interativa" }, textOnly: {}, aiAudio: { "pt-BR": "Áudio por IA" } };
    expect(computedBadges(badges, { interactive: false, hasAudio: true })).toEqual([{ "pt-BR": "Áudio por IA" }]);
    expect(computedBadges(badges, { interactive: true, hasAudio: false })).toEqual([{ "pt-BR": "Interativa" }]);
  });
});
