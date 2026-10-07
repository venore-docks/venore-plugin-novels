CREATE TABLE "novels"."cast_members" (
	"id" text PRIMARY KEY NOT NULL,
	"work_id" text NOT NULL,
	"name" jsonb NOT NULL,
	"color" text DEFAULT 'primary' NOT NULL,
	"portrait_media_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novels"."catalog_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novels"."tag_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" jsonb NOT NULL,
	"category" text DEFAULT 'info' NOT NULL,
	"selection" text DEFAULT 'multiple' NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"allow_custom" boolean DEFAULT false NOT NULL,
	"show_on_card" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tag_groups_category_check" CHECK ("novels"."tag_groups"."category" in ('info', 'production')),
	CONSTRAINT "tag_groups_selection_check" CHECK ("novels"."tag_groups"."selection" in ('single', 'multiple'))
);
--> statement-breakpoint
CREATE TABLE "novels"."tags" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"custom" boolean DEFAULT false NOT NULL,
	"created_by_user_id" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novels"."work_tags" (
	"work_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "work_tags_work_id_tag_id_pk" PRIMARY KEY("work_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "novels"."scenes" ADD COLUMN "blocks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "novels"."works" ADD COLUMN "subtitle" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "novels"."works" ADD COLUMN "cover_focus" jsonb;--> statement-breakpoint
ALTER TABLE "novels"."cast_members" ADD CONSTRAINT "cast_members_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "novels"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novels"."tags" ADD CONSTRAINT "tags_group_id_tag_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "novels"."tag_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novels"."work_tags" ADD CONSTRAINT "work_tags_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "novels"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novels"."work_tags" ADD CONSTRAINT "work_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "novels"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cast_members_work_idx" ON "novels"."cast_members" USING btree ("work_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_groups_key_unique" ON "novels"."tag_groups" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_unique" ON "novels"."tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tags_group_idx" ON "novels"."tags" USING btree ("group_id","position");--> statement-breakpoint
CREATE INDEX "work_tags_tag_idx" ON "novels"."work_tags" USING btree ("tag_id");--> statement-breakpoint
-- Dados (0.9.0): as listas fixas de tags da 0.8.0 viram o catálogo (cópia congelada de
-- seeds/tag-starter-pack.ts), as tags das obras (works.tags) viram linhas de work_tags e o texto +
-- lâmina de cada cena viram blocos. A 0004 apaga as colunas antigas depois desta conversão.
INSERT INTO "novels"."tag_groups" ("id", "key", "name", "category", "selection", "required", "allow_custom", "show_on_card", "position") VALUES
  (gen_random_uuid()::text, 'genero', '{"pt-BR":"Gênero","en":"Genre"}'::jsonb, 'info', 'multiple', false, true, true, 0),
  (gen_random_uuid()::text, 'classificacao', '{"pt-BR":"Classificação indicativa","en":"Age rating"}'::jsonb, 'info', 'single', false, false, true, 1),
  (gen_random_uuid()::text, 'conteudo', '{"pt-BR":"Avisos de conteúdo","en":"Content warnings"}'::jsonb, 'info', 'multiple', false, false, false, 2),
  (gen_random_uuid()::text, 'producao-texto', '{"pt-BR":"Texto","en":"Text"}'::jsonb, 'production', 'single', false, false, false, 3),
  (gen_random_uuid()::text, 'producao-imagens', '{"pt-BR":"Imagens","en":"Images"}'::jsonb, 'production', 'single', false, false, false, 4),
  (gen_random_uuid()::text, 'producao-revisao', '{"pt-BR":"Revisão","en":"Review"}'::jsonb, 'production', 'single', false, false, false, 5),
  (gen_random_uuid()::text, 'producao-traducao', '{"pt-BR":"Tradução","en":"Translation"}'::jsonb, 'production', 'single', false, false, false, 6)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
INSERT INTO "novels"."tags" ("id", "group_id", "slug", "name", "description", "position")
SELECT gen_random_uuid()::text, g."id", v.slug, v.name, v.description, v.position
FROM (VALUES
  ('genero', 'aventura', '{"pt-BR":"Aventura","en":"Adventure"}'::jsonb, '{}'::jsonb, 0),
  ('genero', 'acao', '{"pt-BR":"Ação","en":"Action"}'::jsonb, '{}'::jsonb, 1),
  ('genero', 'fantasia', '{"pt-BR":"Fantasia","en":"Fantasy"}'::jsonb, '{}'::jsonb, 2),
  ('genero', 'ficcao-cientifica', '{"pt-BR":"Ficção científica","en":"Science fiction"}'::jsonb, '{}'::jsonb, 3),
  ('genero', 'terror', '{"pt-BR":"Terror","en":"Horror"}'::jsonb, '{}'::jsonb, 4),
  ('genero', 'suspense', '{"pt-BR":"Suspense","en":"Thriller"}'::jsonb, '{}'::jsonb, 5),
  ('genero', 'misterio', '{"pt-BR":"Mistério","en":"Mystery"}'::jsonb, '{}'::jsonb, 6),
  ('genero', 'romance', '{"pt-BR":"Romance","en":"Romance"}'::jsonb, '{}'::jsonb, 7),
  ('genero', 'drama', '{"pt-BR":"Drama","en":"Drama"}'::jsonb, '{}'::jsonb, 8),
  ('genero', 'comedia', '{"pt-BR":"Comédia","en":"Comedy"}'::jsonb, '{}'::jsonb, 9),
  ('genero', 'historico', '{"pt-BR":"Histórico","en":"Historical"}'::jsonb, '{}'::jsonb, 10),
  ('genero', 'cotidiano', '{"pt-BR":"Cotidiano","en":"Slice of life"}'::jsonb, '{}'::jsonb, 11),
  ('genero', 'rpg', '{"pt-BR":"RPG","en":"RPG"}'::jsonb, '{}'::jsonb, 12),
  ('genero', 'fanfic', '{"pt-BR":"Fanfic","en":"Fan fiction"}'::jsonb, '{}'::jsonb, 13),
  ('classificacao', 'livre', '{"pt-BR":"Livre","en":"All ages"}'::jsonb, '{}'::jsonb, 0),
  ('classificacao', '10-anos', '{"pt-BR":"10+","en":"10+"}'::jsonb, '{}'::jsonb, 1),
  ('classificacao', '12-anos', '{"pt-BR":"12+","en":"12+"}'::jsonb, '{}'::jsonb, 2),
  ('classificacao', '14-anos', '{"pt-BR":"14+","en":"14+"}'::jsonb, '{}'::jsonb, 3),
  ('classificacao', '16-anos', '{"pt-BR":"16+","en":"16+"}'::jsonb, '{}'::jsonb, 4),
  ('classificacao', '18-anos', '{"pt-BR":"18+","en":"18+"}'::jsonb, '{}'::jsonb, 5),
  ('conteudo', 'violencia', '{"pt-BR":"Violência","en":"Violence"}'::jsonb, '{}'::jsonb, 0),
  ('conteudo', 'sangue', '{"pt-BR":"Sangue e gore","en":"Blood and gore"}'::jsonb, '{}'::jsonb, 1),
  ('conteudo', 'sexual', '{"pt-BR":"Conteúdo sexual","en":"Sexual content"}'::jsonb, '{}'::jsonb, 2),
  ('conteudo', 'nudez', '{"pt-BR":"Nudez","en":"Nudity"}'::jsonb, '{}'::jsonb, 3),
  ('conteudo', 'linguagem', '{"pt-BR":"Linguagem forte","en":"Strong language"}'::jsonb, '{}'::jsonb, 4),
  ('conteudo', 'drogas', '{"pt-BR":"Álcool e drogas","en":"Alcohol and drugs"}'::jsonb, '{}'::jsonb, 5),
  ('conteudo', 'suicidio', '{"pt-BR":"Suicídio e automutilação","en":"Suicide and self-harm"}'::jsonb, '{}'::jsonb, 6),
  ('conteudo', 'abuso', '{"pt-BR":"Abuso","en":"Abuse"}'::jsonb, '{}'::jsonb, 7),
  ('conteudo', 'morte', '{"pt-BR":"Morte","en":"Death"}'::jsonb, '{}'::jsonb, 8),
  ('conteudo', 'discriminacao', '{"pt-BR":"Discriminação","en":"Discrimination"}'::jsonb, '{}'::jsonb, 9),
  ('producao-texto', 'texto-humanos', '{"pt-BR":"Feito por humanos","en":"Made by humans"}'::jsonb, '{}'::jsonb, 0),
  ('producao-texto', 'texto-ia', '{"pt-BR":"Feito por IA","en":"Made by AI"}'::jsonb, '{}'::jsonb, 1),
  ('producao-texto', 'texto-auxilio-ia', '{"pt-BR":"Humanos com auxílio de IA","en":"Humans assisted by AI"}'::jsonb, '{"pt-BR":"Feito por pessoas usando IA como ferramenta (sugestões, rascunhos, correções).","en":"Made by people using AI as a tool (suggestions, drafts, corrections)."}'::jsonb, 2),
  ('producao-imagens', 'imagens-humanos', '{"pt-BR":"Feito por humanos","en":"Made by humans"}'::jsonb, '{}'::jsonb, 0),
  ('producao-imagens', 'imagens-ia', '{"pt-BR":"Feito por IA","en":"Made by AI"}'::jsonb, '{}'::jsonb, 1),
  ('producao-imagens', 'imagens-auxilio-ia', '{"pt-BR":"Humanos com auxílio de IA","en":"Humans assisted by AI"}'::jsonb, '{"pt-BR":"Feito por pessoas usando IA como ferramenta (sugestões, rascunhos, correções).","en":"Made by people using AI as a tool (suggestions, drafts, corrections)."}'::jsonb, 2),
  ('producao-revisao', 'revisao-humanos', '{"pt-BR":"Feito por humanos","en":"Made by humans"}'::jsonb, '{}'::jsonb, 0),
  ('producao-revisao', 'revisao-ia', '{"pt-BR":"Feito por IA","en":"Made by AI"}'::jsonb, '{}'::jsonb, 1),
  ('producao-revisao', 'revisao-auxilio-ia', '{"pt-BR":"Humanos com auxílio de IA","en":"Humans assisted by AI"}'::jsonb, '{"pt-BR":"Feito por pessoas usando IA como ferramenta (sugestões, rascunhos, correções).","en":"Made by people using AI as a tool (suggestions, drafts, corrections)."}'::jsonb, 2),
  ('producao-traducao', 'traducao-humanos', '{"pt-BR":"Feito por humanos","en":"Made by humans"}'::jsonb, '{}'::jsonb, 0),
  ('producao-traducao', 'traducao-ia', '{"pt-BR":"Feito por IA","en":"Made by AI"}'::jsonb, '{}'::jsonb, 1),
  ('producao-traducao', 'traducao-auxilio-ia', '{"pt-BR":"Humanos com auxílio de IA","en":"Humans assisted by AI"}'::jsonb, '{"pt-BR":"Feito por pessoas usando IA como ferramenta (sugestões, rascunhos, correções).","en":"Made by people using AI as a tool (suggestions, drafts, corrections)."}'::jsonb, 2)
) AS v(group_key, slug, name, description, position)
JOIN "novels"."tag_groups" g ON g."key" = v.group_key
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "novels"."catalog_settings" ("key", "value") VALUES ('badges', '{"interactive":{"pt-BR":"Interativa","en":"Interactive"},"textOnly":{"pt-BR":"Apenas texto","en":"Text only"},"aiAudio":{"pt-BR":"Áudio gerado por IA","en":"AI-generated audio"}}'::jsonb) ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "novels"."work_tags" ("work_id", "tag_id")
SELECT w."id", t."id" FROM "novels"."works" w
CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(w."tags"->'genres') = 'array' THEN w."tags"->'genres' ELSE '[]'::jsonb END) AS g(key)
JOIN "novels"."tags" t ON t."slug" = replace(g.key, '_', '-')
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "novels"."work_tags" ("work_id", "tag_id")
SELECT w."id", t."id" FROM "novels"."works" w
CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(w."tags"->'content') = 'array' THEN w."tags"->'content' ELSE '[]'::jsonb END) AS c(key)
JOIN "novels"."tags" t ON t."slug" = c.key
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "novels"."work_tags" ("work_id", "tag_id")
SELECT w."id", t."id" FROM "novels"."works" w
JOIN "novels"."tags" t ON t."slug" = CASE w."tags"->>'rating' WHEN 'livre' THEN 'livre' WHEN '10' THEN '10-anos' WHEN '12' THEN '12-anos' WHEN '14' THEN '14-anos' WHEN '16' THEN '16-anos' WHEN '18' THEN '18-anos' END
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "novels"."work_tags" ("work_id", "tag_id")
SELECT w."id", t."id" FROM "novels"."works" w
CROSS JOIN LATERAL jsonb_each_text(CASE WHEN jsonb_typeof(w."tags"->'production') = 'object' THEN w."tags"->'production' ELSE '{}'::jsonb END) AS p(part, origin)
JOIN "novels"."tags" t ON t."slug" =
  (CASE p.part WHEN 'text' THEN 'texto' WHEN 'images' THEN 'imagens' WHEN 'review' THEN 'revisao' WHEN 'translation' THEN 'traducao' END)
  || (CASE p.origin WHEN 'human' THEN '-humanos' WHEN 'ai' THEN '-ia' WHEN 'ai_assisted' THEN '-auxilio-ia' END)
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Gêneros livres viram tags livres (custom) do grupo "genero"; mesmo endereço = mesma tag (inclusive
-- uma oficial: "Terror" livre vira a tag "terror" do catálogo).
CREATE TEMPORARY TABLE "novels_custom_genres" AS
SELECT w."id" AS work_id, w."default_locale" AS locale, trim(c.name) AS name,
  trim(both '-' from regexp_replace(lower(translate(trim(c.name), 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')), '[^a-z0-9]+', '-', 'g')) AS slug
FROM "novels"."works" w
CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(w."tags"->'customGenres') = 'array' THEN w."tags"->'customGenres' ELSE '[]'::jsonb END) AS c(name);--> statement-breakpoint
INSERT INTO "novels"."tags" ("id", "group_id", "slug", "name", "custom", "position")
SELECT gen_random_uuid()::text, g."id", s.slug, jsonb_build_object(s.locale, s.name), true, 1000
FROM (SELECT DISTINCT ON (slug) slug, name, locale FROM "novels_custom_genres" WHERE slug <> '' ORDER BY slug, work_id) s
JOIN "novels"."tag_groups" g ON g."key" = 'genero'
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "novels"."work_tags" ("work_id", "tag_id")
SELECT c.work_id, t."id" FROM "novels_custom_genres" c JOIN "novels"."tags" t ON t."slug" = c.slug
ON CONFLICT DO NOTHING;--> statement-breakpoint
DROP TABLE "novels_custom_genres";--> statement-breakpoint
UPDATE "novels"."scenes" SET "blocks" =
  (CASE WHEN "image_media_id" IS NOT NULL
    THEN jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'type', 'image', 'mediaId', "image_media_id", 'alt', '{}'::jsonb, 'aspect', 'auto', 'bleed', true))
    ELSE '[]'::jsonb END)
  || (CASE WHEN EXISTS (SELECT 1 FROM jsonb_each_text("body") e WHERE trim(e.value) <> '')
    THEN jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'type', 'text', 'text', "body"))
    ELSE '[]'::jsonb END)
WHERE "blocks" = '[]'::jsonb;
