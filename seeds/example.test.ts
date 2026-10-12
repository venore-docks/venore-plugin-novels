import { describe, expect, it, vi } from "vitest";
import type { Story } from "../contracts/types";
import { createContext } from "../shared/engine/context";
import { applyAction, choiceViews, newGame } from "../shared/engine/play";
import { emptySystem } from "../shared/engine/system";
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
    system: emptySystem(),
    items: [],
    creatures: [],
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
    const ctx = createContext(await exampleStory());
    const first = newGame(ctx, { seed: "s" });
    if (!first.ok) throw new Error(first.reason);
    let state = first.state;
    for (const action of [{ t: "choose", choiceId: "ch1-c1" }, { t: "choose", choiceId: "ch1-c3" }, { t: "continue" }] as const) {
      const result = applyAction(ctx, state, action);
      if (!result.ok) throw new Error(result.reason);
      state = result.state;
    }
    expect(choiceViews(ctx, state).map((view) => view.choice.id)).toEqual(["ch2-d1", "ch2-d2", "ch2-d3"]);
  });
});
