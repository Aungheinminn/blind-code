# Blind Code

Vibe-coding platform. Monorepo: `apps/client` (SvelteKit), `apps/server` (Elysia + Bun), `apps/desktop` (Electron), `packages/shared`.

```bash
bun install
bun run dev           # client + server
```

## API keys & platform defaults

Every provider (Anthropic, OpenAI, Google, OpenRouter, Supabase, Vercel) has a **platform key** that lives in the server env and is always available to signed-in users. On top of that, each user can configure their **own key** in Settings → … to override the platform key. The server resolves them in this order:

1. **User key** — if the signed-in user has one configured for that provider, it's used.
2. **Platform key** — otherwise, the server uses the `*_API_KEY` / `*_ACCESS_TOKEN` env var.

Infra env is **required**: `ENCRYPTION_KEY`, `DATABASE_URL`, `SUPABASE_ACCESS_TOKEN`, `VERCEL_API_TOKEN`. The server refuses to start if any is missing.

Platform provider keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENROUTER_API_KEY`) are **optional** — set the ones you have. Any provider without a platform key just means users must bring their own key for that provider in Settings → Providers.

User keys are encrypted at rest with `ENCRYPTION_KEY` (AES-256-GCM).

### Per-prompt override

The composer has a `Key:` chip that cycles **Auto → Yours → Platform**:

- **Auto** (default): the cascade above.
- **Yours**: forces the user key for this prompt; errors if none is set.
- **Platform**: forces the env key for this prompt, even when a user key is set.

### Supabase & Vercel semantics

- **Supabase platform fallback** = `SUPABASE_ACCESS_TOKEN` is a PAT for Blind Code's Supabase org. The agent uses it to **auto-provision a per-user project** under that org. Browse endpoints (list orgs / projects) stay user-only — users without their own PAT don't see the platform org.
- **Vercel platform fallback** = `VERCEL_API_TOKEN` is a token for Blind Code's Vercel account; deploys from users without their own token land there. User-token deploys hit the user's own scope.

### GitHub

GitHub is **user-only**: there's no platform token. Users connect a fine-grained PAT in Settings → GitHub (Contents: read/write, plus Administration: read/write to create repos), then create or link a repo from the GitHub button in the workspace header.

- A push exports the same runnable Vite project as a Vercel deploy and commits it via the Git Data API, so no `git` binary is needed. The export reads Supabase config from `VITE_SUPABASE_*` env vars and never contains `.env` files or service keys.
- If the branch has commits that didn't come from Blind Code, the push is refused until the user picks a new branch or chooses to replace the files. The new commit always sits on top of the remote head, so remote history is never discarded.
- The `github_create_repo` / `github_push` agent tools are **off by default** and are enabled per project under Project settings → Agent tool permissions.

### Database migrations

Schema lives in `packages/shared/schema`; migrations are checked in under `apps/server/drizzle`. After changing the schema:

```bash
bun run --filter ./apps/server db:generate   # writes a new SQL migration — review and commit it
bun run --filter ./apps/server db:migrate    # applies pending migrations
```

CI fails if the schema and migrations disagree. Databases created with `db:push` before migrations existed need a one-time `db:baseline` (marks the baseline migration as applied) before their first `db:migrate`.

### Migrating from the local file store

Older installs stored provider keys in `~/.config/blind-code/auth.json`. Import them into a user's DB record with:

```bash
bun run --filter ./apps/server migrate:keys <userId> [--dry-run]
```

Idempotent — skips providers the user already has.
