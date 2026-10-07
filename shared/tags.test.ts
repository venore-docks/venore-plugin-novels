import { describe, expect, it } from "vitest";
import { describeTags, EMPTY_TAGS, MAX_CUSTOM_TAGS, normalizeTags } from "./tags";

describe("tags da obra", () => {
  it("obra antiga sem tags vira o vazio; lixo do formulário é descartado", () => {
    expect(normalizeTags({})).toEqual(EMPTY_TAGS);
    expect(normalizeTags(null)).toEqual(EMPTY_TAGS);
    expect(
      normalizeTags({
        genres: ["aventura", "aventura", "inexistente", 3],
        customGenres: ["  Tibia ", "tibia", "", "Rookgaard", "a", "b", "c", "d"],
        content: ["violencia", "x"],
        rating: "16",
        production: { text: "human", images: "ai", review: "robô", audio: "ai" },
      }),
    ).toEqual({
      genres: ["aventura"],
      customGenres: ["Tibia", "Rookgaard", "a", "b", "c"].slice(0, MAX_CUSTOM_TAGS),
      content: ["violencia"],
      rating: "16",
      production: { text: "human", images: "ai" },
    });
  });

  it("grupos: informativas (formato calculado) e produção (tradução só multilíngue, áudio sozinho)", () => {
    const tags = normalizeTags({
      genres: ["fanfic", "rpg"],
      customGenres: ["Tibia"],
      content: ["violencia", "sangue"],
      rating: "14",
      production: { text: "human", images: "ai", review: "ai_assisted", translation: "ai" },
    });
    expect(describeTags(tags, { interactive: true, hasAudio: true, multilingual: false })).toEqual({
      info: [
        { label: "Gênero", tags: ["Fanfic", "RPG", "Tibia"] },
        { label: "Formato", tags: ["Interativa"] },
        { label: "Classificação", tags: ["14+"] },
        { label: "Conteúdo", tags: ["Violência", "Sangue e gore"] },
      ],
      production: [
        {
          label: "Produção",
          tags: ["Texto feito por humanos", "Imagens feitas por IA", "Revisão com auxílio de IA", "Áudio gerado por IA"],
        },
      ],
    });
    expect(describeTags(EMPTY_TAGS, { interactive: false })).toEqual({
      info: [{ label: "Formato", tags: ["Apenas texto"] }],
      production: [],
    });
  });
});
