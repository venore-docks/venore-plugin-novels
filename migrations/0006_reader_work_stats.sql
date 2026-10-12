CREATE TABLE "novels"."reader_work_stats" (
	"user_id" text NOT NULL,
	"work_id" text NOT NULL,
	"completions" integer DEFAULT 0 NOT NULL,
	"last_completed_seed" text,
	"scenes_seen" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"choices_seen" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"endings_seen" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"achievements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reader_work_stats_user_id_work_id_pk" PRIMARY KEY("user_id","work_id")
);
--> statement-breakpoint
ALTER TABLE "novels"."reader_work_stats" ADD CONSTRAINT "reader_work_stats_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "novels"."works"("id") ON DELETE cascade ON UPDATE no action;