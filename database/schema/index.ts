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
  ChoiceCondition,
  LocalizedText,
  ReaderState,
  VariableDefinition,
  VariableEffect,
  WorkTags,
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
    synopsis: jsonb("synopsis").$type<LocalizedText>().notNull().default({}),
    defaultLocale: text("default_locale").notNull().default("pt-BR"),
    locales: text("locales").array().notNull().default(sql`ARRAY['pt-BR']::text[]`),
    coverMediaId: text("cover_media_id"),
    variables: jsonb("variables").$type<VariableDefinition[]>().notNull().default([]),
    status: text("status").notNull().default("draft"),
    authorUserId: text("author_user_id"),
    // Leitura em voz alta: marcado pelas ações do bloco "Áudio" da obra
    // (features/speech/manage-work-speech) — o autor gerou ou apagou o áudio.
    speechEnabled: boolean("speech_enabled").notNull().default(false),
    // Tags informativas e de produção (shared/tags.ts). Obra antiga fica com {} = sem tags.
    tags: jsonb("tags").$type<Partial<WorkTags>>().notNull().default({}),
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

// Uma cena = uma lâmina (imagem) + parágrafos de texto estilo livro. graphX/graphY são só a
// posição do nó no editor em grafo, sem efeito na leitura.
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
    imageMediaId: text("image_media_id"),
    body: jsonb("body").$type<LocalizedText>().notNull().default({}),
    isEnding: boolean("is_ending").notNull().default(false),
    endingTitle: jsonb("ending_title").$type<LocalizedText>().notNull().default({}),
    effects: jsonb("effects").$type<VariableEffect[]>().notNull().default([]),
    graphX: real("graph_x").notNull().default(0),
    graphY: real("graph_y").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("scenes_chapter_idx").on(table.chapterId), index("scenes_image_idx").on(table.imageMediaId)],
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
    conditions: jsonb("conditions").$type<ChoiceCondition[]>().notNull().default([]),
    effects: jsonb("effects").$type<VariableEffect[]>().notNull().default([]),
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
    state: jsonb("state").$type<ReaderState>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.workId] })],
);
