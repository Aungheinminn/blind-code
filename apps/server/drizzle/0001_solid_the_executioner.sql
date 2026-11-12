ALTER TABLE "projects" ADD COLUMN "share_token" varchar(64);--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_share_token_uq" UNIQUE("share_token");