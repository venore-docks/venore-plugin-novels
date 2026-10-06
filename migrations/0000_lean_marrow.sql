CREATE SCHEMA "novels";
--> statement-breakpoint
CREATE TABLE "novels"."chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"work_id" text NOT NULL,
	"position" integer NOT NULL,
	"title" jsonb NOT NULL,
	"start_scene_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novels"."choices" (
	"id" text PRIMARY KEY NOT NULL,
	"scene_id" text NOT NULL,
	"target_scene_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"label" jsonb NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"effects" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novels"."reader_progress" (
	"user_id" text NOT NULL,
	"work_id" text NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reader_progress_user_id_work_id_pk" PRIMARY KEY("user_id","work_id")
);
--> statement-breakpoint
CREATE TABLE "novels"."scenes" (
	"id" text PRIMARY KEY NOT NULL,
	"work_id" text NOT NULL,
	"chapter_id" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"image_media_id" text,
	"body" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_ending" boolean DEFAULT false NOT NULL,
	"ending_title" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"effects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"graph_x" real DEFAULT 0 NOT NULL,
	"graph_y" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novels"."works" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" jsonb NOT NULL,
	"synopsis" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"default_locale" text DEFAULT 'pt-BR' NOT NULL,
	"locales" text[] DEFAULT ARRAY['pt-BR']::text[] NOT NULL,
	"cover_media_id" text,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"author_user_id" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "works_status_check" CHECK ("novels"."works"."status" in ('draft', 'in_review', 'published', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "novels"."chapters" ADD CONSTRAINT "chapters_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "novels"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novels"."choices" ADD CONSTRAINT "choices_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "novels"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novels"."choices" ADD CONSTRAINT "choices_target_scene_id_scenes_id_fk" FOREIGN KEY ("target_scene_id") REFERENCES "novels"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novels"."reader_progress" ADD CONSTRAINT "reader_progress_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "novels"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novels"."scenes" ADD CONSTRAINT "scenes_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "novels"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novels"."scenes" ADD CONSTRAINT "scenes_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "novels"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chapters_work_idx" ON "novels"."chapters" USING btree ("work_id","position");--> statement-breakpoint
CREATE INDEX "choices_scene_idx" ON "novels"."choices" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "scenes_chapter_idx" ON "novels"."scenes" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "scenes_image_idx" ON "novels"."scenes" USING btree ("image_media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "works_slug_unique" ON "novels"."works" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "works_status_idx" ON "novels"."works" USING btree ("status");