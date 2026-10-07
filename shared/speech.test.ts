import { describe, expect, it } from "vitest";
import { indexSceneAudio, speechItemsForWork, workSpeechScope } from "./speech";

const text = (id: string, value: Record<string, string>) => ({ id, type: "text" as const, text: value });

describe("speech da obra", () => {
  it("um item por cena e idioma que tem texto próprio", () => {
    const items = speechItemsForWork({ locales: ["pt-BR", "en"] }, [
      { id: "s1", blocks: [text("b1", { "pt-BR": " Olá ", en: "Hi" })] },
      { id: "s2", blocks: [text("b2", { "pt-BR": "Só em português" })] },
      { id: "s3", blocks: [] },
    ]);
    expect(items).toEqual([
      { itemKey: "scene:s1", locale: "pt-BR", text: "Olá" },
      { itemKey: "scene:s1", locale: "en", text: "Hi" },
      { itemKey: "scene:s2", locale: "pt-BR", text: "Só em português" },
    ]);
  });

  it("junta os blocos de texto, tira a formatação e põe o nome de quem fala", () => {
    const items = speechItemsForWork(
      { locales: ["pt-BR"] },
      [
        {
          id: "s1",
          blocks: [
            { id: "i", type: "image", mediaId: "m1", alt: {}, aspect: "auto", bleed: true },
            text("b1", { "pt-BR": "A porta **range**." }),
            { id: "c", type: "caption", mediaId: "m2", alt: {}, caption: { "pt-BR": "Silêncio." }, position: "bottom" },
            { id: "f", type: "speech", castId: "x", text: { "pt-BR": "Quem está aí?" } },
          ],
        },
      ],
      [{ id: "x", name: { "pt-BR": "Faroleiro" }, color: "primary", portraitMediaId: null, position: 0 }],
    );
    expect(items[0].text).toBe("A porta range.\n\nSilêncio.\n\nFaroleiro: Quem está aí?");
  });

  it("indexa as URLs por cena e idioma e ignora item de outro formato", () => {
    expect(
      indexSceneAudio([
        { itemKey: "scene:s1", locale: "pt-BR", url: "/a.mp3" },
        { itemKey: "scene:s1", locale: "en", url: "/b.mp3" },
        { itemKey: "outro", locale: "en", url: "/c.mp3" },
      ]),
    ).toEqual({ s1: { "pt-BR": "/a.mp3", en: "/b.mp3" } });
    expect(workSpeechScope("w1")).toBe("novels.work:w1");
  });
});
