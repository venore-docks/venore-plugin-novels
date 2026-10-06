import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@venore/plugin-sdk";
import { seedUser } from "@venore/plugin-sdk/testing";
import { seedNovelsExample } from "../seeds/example";
import { saveChapterGraph } from "./graph/save-chapter-graph/service";
import { getChapterGraph } from "./graph/get-chapter-graph/service";
import { publishWork } from "./publishing/publish-work/service";
import { unpublishWork } from "./publishing/unpublish-work/service";
import { getPublishedStory } from "./reading/get-published-story/service";
import { listPublishedWorks } from "./reading/list-published-works/service";
import { getReaderProgress } from "./reading/get-reader-progress/service";
import { saveReaderProgress } from "./reading/save-reader-progress/service";
import { createWork } from "./works/create-work/service";
import { deleteWork } from "./works/delete-work/service";
import { getWork } from "./works/get-work/service";
import { findNovelsMediaUsage } from "./media-usage/find-novels-media-usage/service";

// Fluxo cruzando o schema novels com auth (progresso por usuário) contra Postgres real:
// seed completo, leitura publicada, progresso, edição que quebraria a obra publicada, exclusão.
describe("novels — ciclo da obra (integração)", () => {
  beforeEach(async () => {
    await db.execute(sql.raw("TRUNCATE TABLE novels.works CASCADE"));
  });

  it("seed publica O Farol e o leitor recebe o grafo inteiro", async () => {
    expect((await seedNovelsExample()).success).toBe(true);
    expect((await seedNovelsExample()).success).toBe(true);

    const listed = await listPublishedWorks({});
    expect(listed.success && listed.data.map((work) => work.slug)).toEqual(["o-farol"]);

    const story = await getPublishedStory({ slug: "o-farol" });
    expect(story.success).toBe(true);
    if (!story.success) return;
    expect(story.data.chapters).toHaveLength(2);
    expect(story.data.scenes).toHaveLength(8);
    expect(story.data.choices).toHaveLength(7);
    expect(story.data.work.locales).toEqual(["pt-BR", "en"]);
  });

  it("salva e lê progresso do leitor; obra despublicada some da leitura", async () => {
    await seedNovelsExample();
    const story = await getPublishedStory({ slug: "o-farol" });
    if (!story.success) throw new Error("seed");
    const reader = await seedUser({ name: "Leitora" });
    const state = { sceneId: story.data.chapters[0].startSceneId!, vars: { coragem: 0, lanterna: false }, path: [], visitedEndings: [] };

    expect((await saveReaderProgress({ workId: story.data.work.id, state, userId: reader.id })).success).toBe(true);
    const progress = await getReaderProgress({ workId: story.data.work.id, userId: reader.id });
    expect(progress.success && progress.data?.state.sceneId).toBe(state.sceneId);

    await unpublishWork({ workId: story.data.work.id, actorId: "u" });
    expect((await getPublishedStory({ slug: "o-farol" })).success).toBe(false);
    expect((await saveReaderProgress({ workId: story.data.work.id, state, userId: reader.id })).success).toBe(false);
  });

  it("recusa grafo que quebraria obra publicada e aceita depois de despublicar", async () => {
    await seedNovelsExample();
    const story = await getPublishedStory({ slug: "o-farol" });
    if (!story.success) throw new Error("seed");
    const chapter = story.data.chapters[1];
    const graph = await getChapterGraph({ workId: story.data.work.id, chapterId: chapter.id });
    if (!graph.success) throw new Error("graph");

    const broken = { ...graph.data.graph, startSceneId: null };
    const refused = await saveChapterGraph({ workId: story.data.work.id, chapterId: chapter.id, graph: broken, actorId: "u" });
    expect(refused.success).toBe(false);

    await unpublishWork({ workId: story.data.work.id, actorId: "u" });
    const saved = await saveChapterGraph({ workId: story.data.work.id, chapterId: chapter.id, graph: broken, actorId: "u" });
    expect(saved.success && saved.data.issues.some((issue) => issue.code === "missing_start")).toBe(true);
    expect((await publishWork({ workId: story.data.work.id, actorId: "u" })).success).toBe(false);
  });

  it("apagar cena remove as escolhas ligadas a ela; excluir obra apaga tudo", async () => {
    const created = await createWork({ title: "Teste", slug: "teste", defaultLocale: "pt-BR", actorId: "u" });
    if (!created.success) throw new Error("create");
    const detail = await getWork({ workId: created.data.id });
    if (!detail.success) throw new Error("detail");
    const chapterId = detail.data.chapters[0].id;
    const scene = (id: string, isEnding = false) => ({
      id,
      label: id,
      imageMediaId: id === "gn-a" ? "media-1" : null,
      body: { "pt-BR": id },
      isEnding,
      endingTitle: {},
      effects: [],
      graphX: 0,
      graphY: 0,
    });
    const choice = { id: "gn-c", sceneId: "gn-a", targetSceneId: "gn-b", position: 0, label: { "pt-BR": "ir" }, conditions: [], effects: [] };
    await saveChapterGraph({
      workId: created.data.id,
      chapterId,
      graph: { startSceneId: "gn-a", scenes: [scene("gn-a"), scene("gn-b", true)], choices: [choice] },
      actorId: "u",
    });
    expect(await findNovelsMediaUsage("media-1")).toHaveLength(1);

    await saveChapterGraph({ workId: created.data.id, chapterId, graph: { startSceneId: "gn-a", scenes: [scene("gn-a", true)], choices: [] }, actorId: "u" });
    const after = await getChapterGraph({ workId: created.data.id, chapterId });
    expect(after.success && after.data.graph.choices).toEqual([]);
    expect((await publishWork({ workId: created.data.id, actorId: "u" })).success).toBe(true);

    expect((await deleteWork({ workId: created.data.id, actorId: "u" })).success).toBe(true);
    expect(await findNovelsMediaUsage("media-1")).toEqual([]);
  });
});
