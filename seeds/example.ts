import type { OperationResult } from "@venore/plugin-sdk";
import type { ChapterGraph, LocalizedText } from "../contracts/types";
import { createChapter } from "../features/chapters/create-chapter/service";
import { updateChapter } from "../features/chapters/update-chapter/service";
import { saveChapterGraph } from "../features/graph/save-chapter-graph/service";
import { publishWork } from "../features/publishing/publish-work/service";
import { createWork } from "../features/works/create-work/service";
import { getWork } from "../features/works/get-work/service";
import { updateWork } from "../features/works/update-work/service";
import { findWorkRowBySlug } from "../database/queries/story-records";
import { findTagCatalog } from "../database/queries/tag-records";
import { updateWorkVariables } from "../features/works/update-work-variables/service";

// Seed rodado via /admin/plugins, sem sessão: chama service.ts direto (mesmo racional do seed do
// birthdays). actorId é só rótulo de auditoria.
export const EXAMPLE_VARIABLES = [
  // Aparecem no painel do personagem do leitor: coragem como status (0 a 3), lanterna no inventário.
  { key: "coragem", label: "Coragem", type: "number" as const, initial: 0, display: "status" as const, min: 0, max: 3 },
  { key: "lanterna", label: "Lanterna", type: "boolean" as const, initial: false, display: "inventory" as const },
];

const SEED_ACTOR_ID = "system-seed";
const SLUG = "o-farol";

const t = (pt: string, en: string): LocalizedText => ({ "pt-BR": pt, en });

function sceneNode(
  id: string,
  label: string,
  body: LocalizedText,
  x: number,
  y: number,
  extra: Partial<ChapterGraph["scenes"][number]> = {},
): ChapterGraph["scenes"][number] {
  return {
    id,
    label,
    blocks: [{ id: `${id}-t`, type: "text", text: body }],
    isEnding: false,
    endingTitle: {},
    effects: [],
    graphX: x,
    graphY: y,
    ...extra,
  };
}

export function chapterOne(prefix: string): ChapterGraph {
  const id = (key: string) => `${prefix}-${key}`;
  return {
    startSceneId: id("s1"),
    scenes: [
      sceneNode(
        id("s1"),
        "Tempestade",
        t(
          "A tempestade chegou antes do previsto.\n\nDo cais, você vê o farol apagado no alto do rochedo. Ninguém sobe lá há anos.",
          "The storm arrived earlier than expected.\n\nFrom the pier you see the lighthouse, dark on top of the cliff. No one has climbed it in years.",
        ),
        0,
        0,
      ),
      sceneNode(
        id("s2"),
        "Escada",
        t(
          "Os degraus rangem a cada passo.\n\nNa parede, presa por um gancho enferrujado, há uma lanterna velha.",
          "The steps creak with every move.\n\nOn the wall, hanging from a rusty hook, there is an old lantern.",
        ),
        -220,
        200,
      ),
      sceneNode(
        id("s3"),
        "Vila",
        t(
          "Na vila, as janelas estão fechadas. Alguém abre a porta da taberna e puxa você para dentro.\n\nVocê passa a noite seco e seguro, ouvindo o mar.",
          "In the village, every window is shut. Someone opens the tavern door and pulls you inside.\n\nYou spend the night dry and safe, listening to the sea.",
        ),
        220,
        200,
        { isEnding: true, endingTitle: t("Porto seguro", "Safe harbor") },
      ),
      sceneNode(
        id("s4"),
        "Topo",
        t(
          "No topo, a grande lâmpada está apagada.\n\nLá fora, um barco luta contra as ondas, cada vez mais perto das pedras.",
          "At the top, the great lamp is dark.\n\nOutside, a boat fights the waves, drifting closer to the rocks.",
        ),
        -220,
        400,
      ),
    ],
    choices: [
      {
        id: id("c1"),
        sceneId: id("s1"),
        targetSceneId: id("s2"),
        position: 0,
        label: t("Subir até o farol", "Climb to the lighthouse"),
        conditions: [],
        effects: [{ variable: "coragem", operation: "add", value: 1 }],
      },
      {
        id: id("c2"),
        sceneId: id("s1"),
        targetSceneId: id("s3"),
        position: 1,
        label: t("Procurar abrigo na vila", "Look for shelter in the village"),
        conditions: [],
        effects: [],
      },
      {
        id: id("c3"),
        sceneId: id("s2"),
        targetSceneId: id("s4"),
        position: 0,
        label: t("Pegar a lanterna", "Take the lantern"),
        conditions: [],
        effects: [{ variable: "lanterna", operation: "set", value: true }],
      },
      {
        id: id("c4"),
        sceneId: id("s2"),
        targetSceneId: id("s4"),
        position: 1,
        label: t("Seguir no escuro", "Keep going in the dark"),
        conditions: [],
        effects: [],
      },
    ],
  };
}

export function chapterTwo(prefix: string): ChapterGraph {
  const id = (key: string) => `${prefix}-${key}`;
  return {
    startSceneId: id("t1"),
    scenes: [
      sceneNode(
        id("t1"),
        "Pedras",
        t("O barco está a poucos metros das pedras.\n\nVocê tem um instante para decidir.", "The boat is only a few meters from the rocks.\n\nYou have one moment to decide."),
        0,
        0,
      ),
      sceneNode(
        id("t2"),
        "Luz",
        t("A chama da lanterna pega no pavio da grande lâmpada. O facho corta a chuva e o barco vira a tempo.", "The lantern flame catches the great wick. The beam cuts through the rain and the boat turns just in time."),
        -260,
        220,
        { isEnding: true, endingTitle: t("A luz que guia", "The guiding light") },
      ),
      sceneNode(
        id("t3"),
        "Grito",
        t("Você grita com toda a força. Alguém no barco ouve, e o leme gira.", "You shout with all your strength. Someone on the boat hears you, and the rudder turns."),
        0,
        220,
        { isEnding: true, endingTitle: t("Voz na tempestade", "Voice in the storm") },
      ),
      sceneNode(
        id("t4"),
        "Silêncio",
        t("Você espera. O vento leva o barco para longe, e você nunca descobre o que aconteceu.", "You wait. The wind carries the boat away, and you never learn what happened."),
        260,
        220,
        { isEnding: true, endingTitle: t("O silêncio do mar", "The silence of the sea") },
      ),
    ],
    choices: [
      {
        id: id("d1"),
        sceneId: id("t1"),
        targetSceneId: id("t2"),
        position: 0,
        label: t("Acender o farol com a lanterna", "Light the beacon with the lantern"),
        conditions: [{ variable: "lanterna", operator: "eq", value: true }],
        effects: [],
      },
      {
        id: id("d2"),
        sceneId: id("t1"),
        targetSceneId: id("t3"),
        position: 1,
        label: t("Gritar para o barco", "Shout at the boat"),
        conditions: [{ variable: "coragem", operator: "gte", value: 1 }],
        effects: [],
      },
      {
        id: id("d3"),
        sceneId: id("t1"),
        targetSceneId: id("t4"),
        position: 2,
        label: t("Esperar", "Wait"),
        conditions: [],
        effects: [],
      },
    ],
  };
}

// Idempotente: se a obra "o-farol" já existe, não faz nada.
export async function seedNovelsExample(): Promise<OperationResult<void>> {
  if (await findWorkRowBySlug(SLUG)) return { success: true, data: undefined };

  const created = await createWork({ title: "O Farol", slug: SLUG, defaultLocale: "pt-BR", actorId: SEED_ACTOR_ID });
  if (!created.success) return created;
  const workId = created.data.id;

  // Tags do pacote inicial, se o admin não apagou: escolhidas por slug.
  const catalog = await findTagCatalog();
  const tagIds = ["misterio", "aventura", "livre", "texto-humanos"]
    .map((slug) => catalog.tags.find((tag) => tag.slug === slug && !tag.archivedAt)?.id)
    .filter((id): id is string => Boolean(id));

  const updated = await updateWork({
    workId,
    slug: SLUG,
    title: t("O Farol", "The Lighthouse"),
    synopsis: t(
      "Uma noite de tempestade, um farol apagado e um barco perto demais das pedras.",
      "A stormy night, a dark lighthouse and a boat too close to the rocks.",
    ),
    defaultLocale: "pt-BR",
    locales: ["pt-BR", "en"],
    coverMediaId: null,
    tags: { tagIds, newTags: [] },
    actorId: SEED_ACTOR_ID,
  });
  if (!updated.success) return updated;
  const withVariables = await updateWorkVariables({ workId, variables: EXAMPLE_VARIABLES, actorId: SEED_ACTOR_ID });
  if (!withVariables.success) return withVariables;

  const detail = await getWork({ workId });
  if (!detail.success) return detail;
  const firstChapter = detail.data.chapters[0];
  const secondChapter = await createChapter({ workId, title: "A luz", actorId: SEED_ACTOR_ID });
  if (!secondChapter.success) return secondChapter;

  // Ids de cena derivados do id do capítulo: rodar o seed de novo depois de apagar a obra gera
  // capítulos novos, então nunca colide com cenas antigas.
  const saves = [
    await saveChapterGraph({ workId, chapterId: firstChapter.id, graph: chapterOne(firstChapter.id), actorId: SEED_ACTOR_ID }),
    await saveChapterGraph({ workId, chapterId: secondChapter.data.id, graph: chapterTwo(secondChapter.data.id), actorId: SEED_ACTOR_ID }),
  ];
  const failed = saves.find((result) => !result.success);
  if (failed && !failed.success) return failed;

  await updateChapter({ chapterId: firstChapter.id, title: t("A tempestade", "The storm"), actorId: SEED_ACTOR_ID });
  await updateChapter({ chapterId: secondChapter.data.id, title: t("A luz", "The light"), actorId: SEED_ACTOR_ID });

  const published = await publishWork({ workId, actorId: SEED_ACTOR_ID });
  if (!published.success) return published;
  return { success: true, data: undefined };
}
