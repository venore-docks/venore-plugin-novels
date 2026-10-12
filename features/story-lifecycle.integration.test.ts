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
import { getTagCatalog } from "./tags/get-tag-catalog/service";
import { installTagStarterPack, saveTagGroup } from "./tags/manage-tag-catalog/service";
import { updateWork } from "./works/update-work/service";
import { applySystemTemplate, saveWorkAsTemplate, listSystemTemplates } from "./game/system-templates/service";
import { saveItem, deleteItem } from "./game/manage-items/service";
import { startReaderGame } from "./reading/start-reader-game/service";
import { getReaderStats } from "./reading/get-reader-stats/service";
import { getWorkStats } from "./stats/get-work-stats/service";
import { convertLegacyVariables } from "./works/convert-legacy-variables/service";
import { createContext } from "../shared/engine/context";
import { applyAction, replay, toSaved } from "../shared/engine/play";

// Fluxo cruzando o schema novels com auth (progresso por usuário) contra Postgres real:
// seed completo, leitura publicada, progresso, edição que quebraria a obra publicada, exclusão.
describe("novels — ciclo da obra (integração)", () => {
  beforeEach(async () => {
    await db.execute(sql.raw("TRUNCATE TABLE novels.works CASCADE"));
    await db.execute(sql.raw("TRUNCATE TABLE novels.system_templates"));
    // Volta o catálogo ao pacote inicial (um teste pode ter tornado um grupo obrigatório).
    await db.execute(sql.raw("TRUNCATE TABLE novels.tag_groups CASCADE"));
    await installTagStarterPack({ actorId: "u" });
  });

  it("seed publica O Farol e o leitor recebe o grafo inteiro", async () => {
    expect((await seedNovelsExample()).success).toBe(true);
    expect((await seedNovelsExample()).success).toBe(true);

    const listed = await listPublishedWorks({});
    expect(listed.success && listed.data.works.map((work) => work.slug)).toEqual(["o-farol"]);

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

    // Progresso no formato antigo não é mais aceito: a jornada começa no servidor (semente nova).
    expect((await saveReaderProgress({ workId: story.data.work.id, progress: { kind: "legacy", state }, userId: reader.id })).success).toBe(false);
    const started = await startReaderGame({ workId: story.data.work.id, userId: reader.id, start: { t: "start" } });
    if (!started.success) throw new Error(started.error.message);
    const progress = await getReaderProgress({ workId: story.data.work.id, userId: reader.id });
    expect(progress.success && (progress.data?.state as { seed?: string } | undefined)?.seed).toBe(started.data.seed);

    await unpublishWork({ workId: story.data.work.id, actorId: "u" });
    expect((await getPublishedStory({ slug: "o-farol" })).success).toBe(false);
    expect((await saveReaderProgress({ workId: story.data.work.id, progress: { kind: "saved", saved: started.data }, userId: reader.id })).success).toBe(false);
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

  it("catálogo de tags: tag livre nova, filtro por slug e grupo obrigatório bloqueando publicação", async () => {
    await seedNovelsExample();
    const story = await getPublishedStory({ slug: "o-farol" });
    if (!story.success) throw new Error("seed");
    expect(story.data.work.tags.map((group) => group.key)).toEqual(expect.arrayContaining(["genero", "classificacao"]));

    const misterio = await listPublishedWorks({ tag: "misterio" });
    expect(misterio.success && misterio.data.works.map((work) => work.slug)).toEqual(["o-farol"]);
    expect(misterio.success && misterio.data.tag?.slug).toBe("misterio");
    const nada = await listPublishedWorks({ tag: "nao-existe" });
    expect(nada.success && nada.data.works).toEqual([]);

    const catalog = await getTagCatalog();
    if (!catalog.success) throw new Error("catalog");
    const genero = catalog.data.groups.find((group) => group.key === "genero")!;
    const work = await getWork({ workId: story.data.work.id });
    if (!work.success) throw new Error("work");
    const updated = await updateWork({
      workId: story.data.work.id,
      slug: "o-farol",
      title: work.data.work.title,
      synopsis: work.data.work.synopsis,
      defaultLocale: "pt-BR",
      locales: work.data.work.locales,
      coverMediaId: null,
      tags: { tagIds: work.data.tagIds, newTags: [{ groupId: genero.id, name: "Tibia" }] },
      actorId: "u",
    });
    expect(updated.success).toBe(true);
    const tibia = await listPublishedWorks({ tag: "tibia" });
    expect(tibia.success && tibia.data.works).toHaveLength(1);
    expect(tibia.success && tibia.data.tag?.custom).toBe(true);

    const classificacao = catalog.data.groups.find((group) => group.key === "conteudo")!;
    await saveTagGroup({ ...classificacao, id: classificacao.id, required: true, actorId: "u" });
    await unpublishWork({ workId: story.data.work.id, actorId: "u" });
    const refused = await publishWork({ workId: story.data.work.id, actorId: "u" });
    expect(refused.success).toBe(false);
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
      blocks: [
        ...(id === "gn-a" ? [{ id: `${id}-i`, type: "image" as const, mediaId: "media-1", alt: {}, aspect: "auto" as const, bleed: true }] : []),
        { id: `${id}-t`, type: "text" as const, text: { "pt-BR": id } },
      ],
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

    // A cena inicial criada junto com a obra sai (não está no grafo salvo).
    await saveChapterGraph({ workId: created.data.id, chapterId, graph: { startSceneId: "gn-a", scenes: [scene("gn-a", true)], choices: [] }, actorId: "u" });
    const after = await getChapterGraph({ workId: created.data.id, chapterId });
    expect(after.success && after.data.graph.choices).toEqual([]);
    expect((await publishWork({ workId: created.data.id, actorId: "u" })).success).toBe(true);

    expect((await deleteWork({ workId: created.data.id, actorId: "u" })).success).toBe(true);
    expect(await findNovelsMediaUsage("media-1")).toEqual([]);
  });

  it("sistema de jogo: modelo aplicado, item no catálogo, partida conferida no servidor, salvamentos e estatísticas", async () => {
    await seedNovelsExample();
    const published = await getPublishedStory({ slug: "o-farol" });
    if (!published.success) throw new Error("seed");
    const workId = published.data.work.id;

    // Converter as variáveis antigas: coragem (barra 0..3) vira recurso, lanterna vira item.
    const converted = await convertLegacyVariables({ workId, actorId: "u" });
    expect(converted).toEqual({ success: true, data: { resources: ["coragem"], items: ["lanterna"], capacity: null } });
    const afterConversion = await getPublishedStory({ slug: "o-farol" });
    if (!afterConversion.success) throw new Error("leitura");
    expect(afterConversion.data.system.resources.map((resource) => resource.key)).toEqual(["coragem"]);
    expect(afterConversion.data.items.map((item) => item.key)).toEqual(["lanterna"]);

    // Pegar a lanterna ainda libera o final "A luz que guia".
    const ctx = createContext(afterConversion.data);
    const reader = await seedUser({ name: "Jogadora" });
    const started = await startReaderGame({ workId, userId: reader.id, start: { t: "start" } });
    if (!started.success) throw new Error(started.error.message);
    let state = replay(ctx, started.data).state;
    for (const action of [{ t: "choose", choiceId: `${afterConversion.data.chapters[0].id}-c1` }, { t: "choose", choiceId: `${afterConversion.data.chapters[0].id}-c3` }, { t: "continue" }] as const) {
      const result = applyAction(ctx, state, action);
      if (!result.ok) throw new Error(result.reason);
      state = result.state;
    }
    expect(state.bag.map((stack) => ctx.items.get(stack.itemId)?.key)).toEqual(["lanterna"]);
    const saved = await saveReaderProgress({ workId, userId: reader.id, progress: { kind: "saved", saved: toSaved(state) } });
    expect(saved).toEqual({ success: true, data: { updatedAt: expect.any(Date), truncated: false } });
    // Semente trocada no meio da partida é recusada.
    expect((await saveReaderProgress({ workId, userId: reader.id, progress: { kind: "saved", saved: { ...toSaved(state), seed: "forjada" } } })).success).toBe(false);

    // Voltar na história (registro que não continua o salvo) é recusado.
    expect((await saveReaderProgress({ workId, userId: reader.id, progress: { kind: "saved", saved: started.data } })).success).toBe(false);
    // Desempenho somado: cenas vistas e escolhas feitas nesta jornada.
    const stats = await getReaderStats({ workId, userId: reader.id });
    expect(stats.success && stats.data?.choicesSeen.length).toBe(2);

    const workStats = await getWorkStats({ workId });
    expect(workStats.success && workStats.data.readers).toBe(1);
    expect(workStats.success && workStats.data.choices.length).toBe(2);

    // Modelo aplicado num rascunho novo, item novo no catálogo e o sistema salvo como modelo.
    const draft = await createWork({ title: "Arena", slug: "arena", defaultLocale: "pt-BR", actorId: "u" });
    if (!draft.success) throw new Error("rascunho");
    const applied = await applySystemTemplate({ workId: draft.data.id, templateKey: "rpg_fantasia", actorId: "u" });
    expect(applied).toEqual({ success: true, data: { items: 6, creatures: 2 } });
    const item = await saveItem({ workId: draft.data.id, item: { key: "tocha", name: { "pt-BR": "Tocha" }, type: "material", weight: 1 }, actorId: "u" });
    expect(item.success).toBe(true);
    expect((await saveItem({ workId: draft.data.id, item: { key: "tocha", name: { "pt-BR": "Outra" } }, actorId: "u" })).success).toBe(false);
    if (item.success) expect((await deleteItem({ workId: draft.data.id, id: item.data.id, actorId: "u" })).success).toBe(true);
    const asTemplate = await saveWorkAsTemplate({ workId: draft.data.id, key: "arena", name: { "pt-BR": "Arena" }, description: {}, actorId: "u" });
    expect(asTemplate.success).toBe(true);
    const templates = await listSystemTemplates();
    expect(templates.success && templates.data.find((template) => template.key === "arena")?.package.items).toHaveLength(6);
    const view = await getWork({ workId: draft.data.id });
    expect(view.success && view.data.items.length).toBe(6);
    expect(view.success && view.data.creatures.length).toBe(2);
  });
});
