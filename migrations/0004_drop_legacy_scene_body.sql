DROP INDEX "novels"."scenes_image_idx";--> statement-breakpoint
ALTER TABLE "novels"."scenes" DROP COLUMN "image_media_id";--> statement-breakpoint
ALTER TABLE "novels"."scenes" DROP COLUMN "body";--> statement-breakpoint
ALTER TABLE "novels"."works" DROP COLUMN "tags";