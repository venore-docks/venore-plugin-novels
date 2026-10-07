import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  ChoiceMechanics,
  Condition,
  Effect,
  GameSystem,
  LootEntry,
  Modifier,
  SceneMechanics,
  SystemTemplatePackage,
} from "../../contracts/game";
import type { SavedGame } from "../../shared/engine/types";
import type {
  AccentColor,
  CatalogBadges,
  CoverFocus,
  LocalizedText,
  ReaderState,
  SceneBlock,
  VariableDefinition,
} from "../../contracts/types";

export const novelsSchema = pgSchema("novels");

// authorUserId é texto solto, sem FK pra auth.users: plugin não importa schema de context
// (mesmo tratamento de academy.courses.createdBy e birthdays.createdByUserId). Usuário apagado
// deixa o id órfão; a exibição tolera.
export const works = novelsSchema.table(
  "works",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    slug: text("slug").notNull(),
    title: jsonb("title").$type<LocalizedText>().notNull(),
    subtitle: jsonb("subtitle").$type<LocalizedText>().notNull().default({}),
    synopsis: jsonb("synopsis").$type<LocalizedText>().notNull().default({}),
    defaultLocale: text("default_locale").notNull().default("pt-BR"),
    locales: text("locales").array().notNull().default(sql`ARRAY['pt-BR']::text[]`),
    coverMediaId: text("cover_media_id"),
    // Ponto da capa que fica no recorte 2:3; null = centro.
    coverFocus: jsonb("cover_focus").$type<CoverFocus>(),
    variables: jsonb("variables").$type<VariableDefinition[]>().notNull().default([]),
    // Sistema de jogo (módulos, recursos, atributos, fórmulas...): lido inteiro a cada leitura e
    // editado como uma unidade na aba Sistema. {} = obra só narrativa.
    gameSystem: jsonb("game_system").$type<Partial<GameSystem>>().notNull().default({}),
    status: text("status").notNull().default("draft"),
    authorUserId: text("author_user_id"),
    // Leitura em voz alta: marcado pelas ações do bloco "Áudio" da obra
    // (features/speech/manage-work-speech) — o autor gerou ou apagou o áudio.
    speechEnabled: boolean("speech_enabled").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("works_slug_unique").on(table.slug),
    index("works_status_idx").on(table.status),
    check("works_status_check", sql`${table.status} in ('draft', 'in_review', 'published', 'rejected')`),
  ],
);

// startSceneId sem FK pra scenes: cenas referenciam o capítulo, e um FK de volta fecharia ciclo
// (capítulo <-> cena). Quem garante que a cena existe e pertence ao capítulo é o
// save-chapter-graph e o validador de publicação (shared/story-validation.ts).
export const chapters = novelsSchema.table(
  "chapters",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: jsonb("title").$type<LocalizedText>().notNull(),
    startSceneId: text("start_scene_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("chapters_work_idx").on(table.workId, table.position)],
);

// Uma cena = sequência de blocos (texto, imagens, legenda, fala...; shared/scene-blocks.ts).
// graphX/graphY são só a posição do nó no editor em grafo, sem efeito na leitura.
export const scenes = novelsSchema.table(
  "scenes",
  {
    id: text("id").primaryKey(),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    label: text("label").notNull().default(""),
    blocks: jsonb("blocks").$type<SceneBlock[]>().notNull().default([]),
    isEnding: boolean("is_ending").notNull().default(false),
    endingTitle: jsonb("ending_title").$type<LocalizedText>().notNull().default({}),
    effects: jsonb("effects").$type<Effect[]>().notNull().default([]),
    // Tipo da cena (texto, encontro, loja) e regras de jogo dela.
    mechanics: jsonb("mechanics").$type<Partial<SceneMechanics>>().notNull().default({}),
    graphX: real("graph_x").notNull().default(0),
    graphY: real("graph_y").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("scenes_chapter_idx").on(table.chapterId)],
);

export const choices = novelsSchema.table(
  "choices",
  {
    id: text("id").primaryKey(),
    sceneId: text("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    targetSceneId: text("target_scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    label: jsonb("label").$type<LocalizedText>().notNull(),
    conditions: jsonb("conditions").$type<Condition[]>().notNull().default([]),
    effects: jsonb("effects").$type<Effect[]>().notNull().default([]),
    // Custo em recurso e teste de dados.
    mechanics: jsonb("mechanics").$type<Partial<ChoiceMechanics>>().notNull().default({}),
  },
  (table) => [index("choices_scene_idx").on(table.sceneId)],
);

// Progresso de quem lê logado. Sem login, o leitor guarda o mesmo ReaderState em localStorage.
export const readerProgress = novelsSchema.table(
  "reader_progress",
  {
    userId: text("user_id").notNull(),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    // Partida em andamento: registro de ações (SavedGame, 0.10.0) ou o formato antigo.
    state: jsonb("state").$type<ReaderState | SavedGame>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.workId] })],
);

// Salvamentos nomeados do leitor com conta (0.13.0): até 3 por obra, além da partida em andamento.
export const readerSaves = novelsSchema.table(
  "reader_saves",
  {
    userId: text("user_id").notNull(),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull(),
    name: text("name").notNull().default(""),
    sceneLabel: jsonb("scene_label").$type<LocalizedText>().notNull().default({}),
    state: jsonb("state").$type<SavedGame>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.workId, table.slot] }), check("reader_saves_slot_range", sql`${table.slot} between 1 and 3`)],
);

// ------------------------------------------------------------------ catálogo de tags (0.9.0)

export const tagGroups = novelsSchema.table(
  "tag_groups",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    key: text("key").notNull(),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    category: text("category").notNull().default("info"),
    selection: text("selection").notNull().default("multiple"),
    required: boolean("required").notNull().default(false),
    allowCustom: boolean("allow_custom").notNull().default(false),
    showOnCard: boolean("show_on_card").notNull().default(false),
    position: integer("position").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("tag_groups_key_unique").on(table.key),
    check("tag_groups_category_check", sql`${table.category} in ('info', 'production')`),
    check("tag_groups_selection_check", sql`${table.selection} in ('single', 'multiple')`),
  ],
);

// slug único na instância inteira: é o endereço do filtro (/novels?tag=terror).
export const tags = novelsSchema.table(
  "tags",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    groupId: text("group_id")
      .notNull()
      .references(() => tagGroups.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    description: jsonb("description").$type<LocalizedText>().notNull().default({}),
    position: integer("position").notNull().default(0),
    custom: boolean("custom").notNull().default(false),
    createdByUserId: text("created_by_user_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("tags_slug_unique").on(table.slug), index("tags_group_idx").on(table.groupId, table.position)],
);

export const workTags = novelsSchema.table(
  "work_tags",
  {
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.workId, table.tagId] }), index("work_tags_tag_idx").on(table.tagId)],
);

// Configuração do catálogo que não é tag (hoje: textos dos selos calculados).
export const catalogSettings = novelsSchema.table("catalog_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<CatalogBadges | Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ------------------------------------------------------------------ elenco (0.9.0)

export const castMembers = novelsSchema.table(
  "cast_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    color: text("color").$type<AccentColor>().notNull().default("primary"),
    portraitMediaId: text("portrait_media_id"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("cast_members_work_idx").on(table.workId, table.position)],
);

// ------------------------------------------------------------------ jogo (0.10.0)

// Catálogo de itens da obra (inventário, equipamento, lojas, saque).
export const items = novelsSchema.table(
  "items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    description: jsonb("description").$type<LocalizedText>().notNull().default({}),
    imageMediaId: text("image_media_id"),
    type: text("type").notNull().default("material"),
    slot: text("slot"),
    hands: integer("hands").notNull().default(0),
    size: integer("size").notNull().default(1),
    weight: real("weight").notNull().default(0),
    stackable: boolean("stackable").notNull().default(false),
    maxStack: integer("max_stack").notNull().default(1),
    modifiers: jsonb("modifiers").$type<Modifier[]>().notNull().default([]),
    useEffects: jsonb("use_effects").$type<Effect[]>().notNull().default([]),
    consumable: boolean("consumable").notNull().default(false),
    requirements: jsonb("requirements").$type<{ key: string; min: number }[]>().notNull().default([]),
    containerSlots: integer("container_slots").notNull().default(0),
    value: integer("value").notNull().default(0),
    rarity: text("rarity").notNull().default("common"),
    droppable: boolean("droppable").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("items_work_key_unique").on(table.workId, table.key), index("items_image_idx").on(table.imageMediaId)],
);

// Bestiário da obra (inimigos dos encontros).
export const creatures = novelsSchema.table(
  "creatures",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    description: jsonb("description").$type<LocalizedText>().notNull().default({}),
    imageMediaId: text("image_media_id"),
    stats: jsonb("stats").$type<Record<string, number>>().notNull().default({}),
    hp: integer("hp").notNull().default(10),
    behavior: text("behavior").notNull().default("attack"),
    xp: integer("xp").notNull().default(0),
    loot: jsonb("loot").$type<LootEntry[]>().notNull().default([]),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("creatures_work_key_unique").on(table.workId, table.key)],
);

// Modelos de sistema de jogo (pacotes importáveis, como os plugins): aplicar numa obra copia.
export const systemTemplates = novelsSchema.table(
  "system_templates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    key: text("key").notNull(),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    description: jsonb("description").$type<LocalizedText>().notNull().default({}),
    package: jsonb("package").$type<SystemTemplatePackage>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("system_templates_key_unique").on(table.key)],
);
