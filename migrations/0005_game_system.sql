CREATE TABLE "novels"."creatures" (
	"id" text PRIMARY KEY NOT NULL,
	"work_id" text NOT NULL,
	"key" text NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"image_media_id" text,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hp" integer DEFAULT 10 NOT NULL,
	"behavior" text DEFAULT 'attack' NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"loot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novels"."items" (
	"id" text PRIMARY KEY NOT NULL,
	"work_id" text NOT NULL,
	"key" text NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"image_media_id" text,
	"type" text DEFAULT 'material' NOT NULL,
	"slot" text,
	"hands" integer DEFAULT 0 NOT NULL,
	"size" integer DEFAULT 1 NOT NULL,
	"weight" real DEFAULT 0 NOT NULL,
	"stackable" boolean DEFAULT false NOT NULL,
	"max_stack" integer DEFAULT 1 NOT NULL,
	"modifiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"use_effects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"consumable" boolean DEFAULT false NOT NULL,
	"requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"container_slots" integer DEFAULT 0 NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"rarity" text DEFAULT 'common' NOT NULL,
	"droppable" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novels"."reader_saves" (
	"user_id" text NOT NULL,
	"work_id" text NOT NULL,
	"slot" integer NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"scene_label" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reader_saves_user_id_work_id_slot_pk" PRIMARY KEY("user_id","work_id","slot"),
	CONSTRAINT "reader_saves_slot_range" CHECK ("novels"."reader_saves"."slot" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "novels"."system_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"package" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "novels"."choices" ADD COLUMN "mechanics" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "novels"."scenes" ADD COLUMN "mechanics" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "novels"."works" ADD COLUMN "game_system" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "novels"."creatures" ADD CONSTRAINT "creatures_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "novels"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novels"."items" ADD CONSTRAINT "items_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "novels"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novels"."reader_saves" ADD CONSTRAINT "reader_saves_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "novels"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "creatures_work_key_unique" ON "novels"."creatures" USING btree ("work_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "items_work_key_unique" ON "novels"."items" USING btree ("work_id","key");--> statement-breakpoint
CREATE INDEX "items_image_idx" ON "novels"."items" USING btree ("image_media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "system_templates_key_unique" ON "novels"."system_templates" USING btree ("key");