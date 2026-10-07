import { describe, expect, it } from "vitest";
import { hasBlockingIssues, validateStory } from "./story-validation";
import { buildStory, choice, scene } from "./story-fixture.test-support";

function codes(issues: { code: string }[]) {
  return issues.map((issue) => issue.code);
}

describe("validateStory", () => {
  it("obra da fixture é publicável", () => {
    const issues = validateStory(buildStory());
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it("aponta beco sem saída no último capítulo", () => {
    const story = buildStory();
    story.scenes.push(scene({ id: "e", chapterId: "ch2" }));
    story.choices.push(choice({ id: "x", sceneId: "d", targetSceneId: "e" }));
    story.scenes = story.scenes.map((s) => (s.id === "d" ? { ...s, isEnding: false } : s));
    expect(codes(validateStory(story))).toContain("dead_end");
  });

  it("aponta escolha entre capítulos, cena inalcançável e variável desconhecida", () => {
    const story = buildStory();
    story.scenes.push(scene({ id: "solta", chapterId: "ch1", isEnding: true }));
    story.choices.push(choice({ id: "cross", sceneId: "b", targetSceneId: "d" }));
    story.choices.push(
      choice({ id: "bad", sceneId: "b", targetSceneId: "c", conditions: [{ variable: "medo", operator: "eq", value: 1 }] }),
    );
    const found = codes(validateStory(story));
    expect(found).toEqual(expect.arrayContaining(["cross_chapter_choice", "unreachable_scene", "unknown_variable"]));
  });

  it("aponta capítulo sem cena inicial e final com escolhas", () => {
    const story = buildStory();
    story.chapters = story.chapters.map((c) => (c.id === "ch1" ? { ...c, startSceneId: null } : c));
    story.choices.push(choice({ id: "from-end", sceneId: "c", targetSceneId: "a" }));
    expect(codes(validateStory(story))).toEqual(expect.arrayContaining(["missing_start", "ending_with_choices"]));
  });

  it("tradução faltando é aviso, não erro", () => {
    const story = buildStory();
    story.work.locales = ["pt-BR", "en"];
    const issues = validateStory(story);
    expect(issues.some((issue) => issue.code === "missing_translation" && issue.severity === "warning")).toBe(true);
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it("recusa operação incompatível com o tipo da variável", () => {
    const story = buildStory();
    story.choices[0] = { ...story.choices[0], effects: [{ variable: "chave", operation: "add", value: 1 }] };
    expect(codes(validateStory(story))).toContain("effect_type_mismatch");
  });

  it("confere os blocos: legenda longa e fala de alguém fora do elenco são erro; bloco vazio é aviso", () => {
    const story = buildStory();
    story.cast = [];
    story.scenes[0] = {
      ...story.scenes[0],
      blocks: [
        { id: "c", type: "caption", mediaId: "m", alt: {}, caption: { "pt-BR": "x".repeat(181) }, position: "bottom" },
        { id: "f", type: "speech", castId: "sumiu", text: { "pt-BR": "Oi" } },
        { id: "i", type: "image", mediaId: null, alt: {}, aspect: "auto", bleed: false },
      ],
    };
    const issues = validateStory({ ...story, cast: [] });
    expect(codes(issues)).toEqual(expect.arrayContaining(["caption_too_long", "unknown_cast", "empty_image"]));
    expect(issues.find((issue) => issue.code === "empty_image")?.severity).toBe("warning");
  });

  it("recusa variável com chave inválida ou duplicada", () => {
    const story = buildStory();
    story.work.variables.push({ key: "Coragem!", label: "x", type: "number", initial: 0 });
    story.work.variables.push({ key: "coragem", label: "x", type: "number", initial: 0 });
    expect(codes(validateStory(story))).toEqual(expect.arrayContaining(["invalid_variable_key", "duplicate_variable"]));
  });
});
