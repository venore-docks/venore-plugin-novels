import type { ChoiceRecord, Story, StoryScene } from "../contracts/types";

// Obra mínima usada pelos testes do motor e do validador:
// Cap. 1: a -> (b | c[precisa coragem>=1]); b -> fim de capítulo; c = final
// Cap. 2: d = final
export function scene(overrides: Partial<StoryScene> & { id: string; chapterId: string }): StoryScene {
  return {
    label: overrides.id,
    blocks: [{ id: `${overrides.id}-t`, type: "text", text: { "pt-BR": `Texto ${overrides.id}` } }],
    isEnding: false,
    endingTitle: {},
    effects: [],
    graphX: 0,
    graphY: 0,
    ...overrides,
  };
}

export function choice(overrides: Partial<ChoiceRecord> & { id: string; sceneId: string; targetSceneId: string }): ChoiceRecord {
  return { position: 0, label: { "pt-BR": `Escolha ${overrides.id}` }, conditions: [], effects: [], ...overrides };
}

export function buildStory(): Story {
  return {
    work: {
      id: "w1",
      slug: "obra",
      title: { "pt-BR": "Obra" },
      subtitle: {},
      synopsis: {},
      defaultLocale: "pt-BR",
      locales: ["pt-BR"],
      coverUrl: null,
      coverFocus: null,
      tags: [],
      variables: [
        { key: "coragem", label: "Coragem", type: "number", initial: 0 },
        { key: "chave", label: "Pegou a chave", type: "boolean", initial: false },
      ],
    },
    chapters: [
      { id: "ch2", position: 2, title: { "pt-BR": "Dois" }, startSceneId: "d" },
      { id: "ch1", position: 1, title: { "pt-BR": "Um" }, startSceneId: "a" },
    ],
    scenes: [
      scene({ id: "a", chapterId: "ch1" }),
      scene({ id: "b", chapterId: "ch1", effects: [{ variable: "chave", operation: "toggle", value: true }] }),
      scene({ id: "c", chapterId: "ch1", isEnding: true, endingTitle: { "pt-BR": "Final corajoso" } }),
      scene({ id: "d", chapterId: "ch2", isEnding: true }),
    ],
    badges: { interactive: { "pt-BR": "Interativa" }, textOnly: { "pt-BR": "Apenas texto" }, aiAudio: {} },
    cast: [],
    media: {},
    audio: {},
    choices: [
      choice({ id: "a-b", sceneId: "a", targetSceneId: "b", position: 0, effects: [{ variable: "coragem", operation: "add", value: 1 }] }),
      choice({
        id: "a-c",
        sceneId: "a",
        targetSceneId: "c",
        position: 1,
        conditions: [{ variable: "coragem", operator: "gte", value: 1 }],
      }),
    ],
  };
}
