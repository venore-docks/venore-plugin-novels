import { describe, expect, it } from "vitest";
import type { SceneBlock } from "../contracts/types";
import { parseInline, stripInline } from "./inline-format";
import { blocksFromLegacy, normalizeBlocks, sceneExcerpt, sceneMediaIds, sceneWordStats } from "./scene-blocks";

const blocks: SceneBlock[] = [
  { id: "1", type: "backdrop", mediaId: "fundo", alt: {}, text: { "pt-BR": "O farol *apagado*." } },
  { id: "2", type: "gallery", images: [{ mediaId: "a", alt: {} }, { mediaId: "b", alt: {} }] },
  { id: "3", type: "text", text: { "pt-BR": "Um dois três quatro" } },
];

describe("blocos da cena", () => {
  it("mídia de todos os blocos, trecho e contagem", () => {
    expect(sceneMediaIds(blocks)).toEqual(["fundo", "a", "b"]);
    expect(sceneExcerpt(blocks, "en", "pt-BR")).toBe("O farol apagado.");
    expect(sceneWordStats(blocks, "pt-BR").words).toBe(7);
  });

  it("normaliza traduções e valores fora da lista", () => {
    const normalized = normalizeBlocks(
      [
        { id: "1", type: "text", text: { "pt-BR": " oi ", fr: "salut" } },
        { id: "2", type: "image", mediaId: "m", alt: {}, aspect: "9:16" as never, bleed: "sim" as never },
      ],
      ["pt-BR"],
    );
    expect(normalized).toEqual([
      { id: "1", type: "text", text: { "pt-BR": "oi" } },
      { id: "2", type: "image", mediaId: "m", alt: {}, aspect: "auto", bleed: true },
    ]);
  });

  it("converte o formato antigo", () => {
    let n = 0;
    const id = () => `b${(n += 1)}`;
    expect(blocksFromLegacy({ body: { "pt-BR": "Texto" }, imageMediaId: "m" }, id).map((block) => block.type)).toEqual(["image", "text"]);
    expect(blocksFromLegacy({ body: { "pt-BR": " " }, imageMediaId: null }, id)).toEqual([]);
  });

  it("formatação leve", () => {
    expect(parseInline("a **b** *c*")).toEqual([
      { text: "a ", bold: false, italic: false },
      { text: "b", bold: true, italic: false },
      { text: " ", bold: false, italic: false },
      { text: "c", bold: false, italic: true },
    ]);
    expect(stripInline("**Olá**, *mundo*")).toBe("Olá, mundo");
  });
});
