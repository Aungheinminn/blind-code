CREATE TYPE "public"."design_template_origin" AS ENUM('builtin', 'user', 'agent');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"avatar_url" text,
	"password_hash" text NOT NULL,
	"integrations" jsonb,
	"credits_balance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"deployment_settings" jsonb,
	"integrations" jsonb,
	"agent_tool_permissions" jsonb,
	"design_template_id" uuid,
	"context_summary" text,
	"context_summary_covers" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"path" varchar(512) NOT NULL,
	"content" text NOT NULL,
	"is_directory" boolean DEFAULT false NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"action_type" varchar(80) NOT NULL,
	"summary" text,
	"payload" jsonb,
	"stdout" text,
	"stderr" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"model" varchar(120) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "plan_todos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"todo_key" varchar(32) NOT NULL,
	"title" text NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"note" text,
	"order_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"files" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_call_cache" (
	"session_id" uuid NOT NULL,
	"tool_call_id" varchar(200) NOT NULL,
	"tool_name" varchar(80) NOT NULL,
	"input_hash" varchar(64) NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tool_call_cache_session_id_tool_call_id_pk" PRIMARY KEY("session_id","tool_call_id")
);
--> statement-breakpoint
CREATE TABLE "turn_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"turn_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'running' NOT NULL,
	"next_event_ordinal" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "sample_builds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text NOT NULL,
	"accent" varchar(40) NOT NULL,
	"prompt" text NOT NULL,
	"image" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sample_builds_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "design_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80),
	"name" varchar(160) NOT NULL,
	"description" text,
	"content" text NOT NULL,
	"parsed_tokens" jsonb,
	"origin" "design_template_origin" NOT NULL,
	"owner_user_id" uuid,
	"source_project_id" uuid,
	"is_read_only" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "design_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "credits_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" varchar(32) NOT NULL,
	"balance_after" integer NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credits_transactions" ADD CONSTRAINT "credits_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_todos_plan_key_uq" ON "plan_todos" USING btree ("plan_id","todo_key");--> statement-breakpoint
CREATE UNIQUE INDEX "project_checkpoints_session_uq" ON "project_checkpoints" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "project_checkpoints_project_idx" ON "project_checkpoints" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "turn_events_turn_ordinal_uq" ON "turn_events" USING btree ("turn_id","ordinal");