import { describe, expect, it } from "vitest";
import { indexSceneAudio, speechItemsForWork, workSpeechScope } from "./speech";

describe("speech da obra", () => {
  it("um item por cena e idioma que tem texto próprio", () => {
    const items = speechItemsForWork({ locales: ["pt-BR", "en"] }, [
      { id: "s1", body: { "pt-BR": " Olá ", en: "Hi" } },
      { id: "s2", body: { "pt-BR": "Só em português" } },
      { id: "s3", body: {} },
    ]);
    expect(items).toEqual([
      { itemKey: "scene:s1", locale: "pt-BR", text: "Olá" },
      { itemKey: "scene:s1", locale: "en", text: "Hi" },
      { itemKey: "scene:s2", locale: "pt-BR", text: "Só em português" },
    ]);
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
