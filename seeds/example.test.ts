import { describe, expect, it, vi } from "vitest";
import type { Story } from "../contracts/types";
import { choose, continueToNextChapter, indexStory, nextStep, startStory } from "../shared/story-engine";
import { hasBlockingIssues, validateStory } from "../shared/story-validation";

vi.mock("@venore/plugin-sdk", () => ({ db: {} }));
vi.mock("@venore/plugin-sdk/observability", () => ({ beginOperation: vi.fn(), endOperation: vi.fn() }));
vi.mock("@venore/plugin-sdk/rbac", () => ({ authorizeActor: vi.fn() }));
vi.mock("@venore/plugin-sdk/media", () => ({ getMediaAssetUrls: vi.fn() }));

async function exampleStory(): Promise<Story> {
  const { chapterOne, chapterTwo, EXAMPLE_VARIABLES } = await import("./example");
  const one = chapterOne("ch1");
  const two = chapterTwo("ch2");
  return {
    work: {
      id: "w",
      slug: "o-farol",
      title: { "pt-BR": "O Farol", en: "The Lighthouse" },
      subtitle: {},
      synopsis: {},
      defaultLocale: "pt-BR",
      locales: ["pt-BR", "en"],
      coverUrl: null,
      coverFocus: null,
      tags: [],
      variables: EXAMPLE_VARIABLES,
    },
    badges: { interactive: {}, textOnly: {}, aiAudio: {} },
    cast: [],
    media: {},
    audio: {},
    chapters: [
      { id: "ch1", position: 1, title: { "pt-BR": "A tempestade", en: "The storm" }, startSceneId: one.startSceneId },
      { id: "ch2", position: 2, title: { "pt-BR": "A luz", en: "The light" }, startSceneId: two.startSceneId },
    ],
    scenes: [
      ...one.scenes.map((scene) => ({ ...scene, chapterId: "ch1" })),
      ...two.scenes.map((scene) => ({ ...scene, chapterId: "ch2" })),
    ],
    choices: [...one.choices, ...two.choices],
  };
}

describe("seed O Farol", () => {
  it("é publicável e sem avisos de tradução", async () => {
    const issues = validateStory(await exampleStory());
    expect(hasBlockingIssues(issues)).toBe(false);
    expect(issues).toEqual([]);
  });

  it("pegar a lanterna libera o final 'A luz que guia'", async () => {
    const story = await exampleStory();
    const index = indexStory(story);
    let state = startStory(story, index)!;
    for (const choiceId of ["ch1-c1", "ch1-c3"]) {
      const result = choose(story, index, state, choiceId);
      if (!result.ok) throw new Error(choiceId);
      state = result.state;
    }
    const next = continueToNextChapter(story, index, state);
    if (!next.ok) throw new Error("capítulo 2");
    const step = nextStep(story, index, next.state);
    expect(step.kind === "choices" && step.choices.map((choice) => choice.id)).toEqual(["ch2-d1", "ch2-d2", "ch2-d3"]);
  });
});
