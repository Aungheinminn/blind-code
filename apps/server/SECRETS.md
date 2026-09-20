# Secrets at rest

Sensitive credentials in the database are encrypted with AES-256-GCM
before write and decrypted on read at the repo layer.

## The encryption key

Read from the `ENCRYPTION_KEY` env var at server startup. Must decode
from base64 to exactly 32 bytes. If missing or malformed, the server
refuses to start.

Generate one:

```sh
openssl rand -base64 32
```

Put it in `apps/server/.env`:

```
ENCRYPTION_KEY=<paste output>
```

The scripts in `apps/server/scripts/` also require it (they import
`services/crypto.ts`), so keep it set in the same shell / `.env`.

## What's encrypted

- `users.integrations.supabase.accessToken` — Supabase PAT
- `projects.integrations.supabase.serviceRoleKey`
- `projects.integrations.supabase.databaseUrl`

Not encrypted (not sensitive): url, anonKey, projectRef, connectedAt,
everything else.

## Storage format

Each encrypted value in the DB looks like:

```
v1:<iv_b64>:<ciphertext_b64>:<tag_b64>
```

Reads use `decryptMaybe()`, which passes through legacy plaintext
values (no `v1:` prefix) so a partially-migrated DB keeps working.

## Backup

**Back up the key file.** If you lose the key, every encrypted value
in the DB is unrecoverable. There is no reset — you would have to
disconnect every user's Supabase integration and re-collect their
PATs from scratch.

Store a copy somewhere the DB backups cannot reach (a password
manager, a secrets vault, an offline note). If the DB backup and the
key are stolen together, encryption gives you nothing.

## Migrating existing plaintext rows

If you're upgrading a DB that already has plaintext PATs / keys from
before this feature landed, run once after deploying the new code:

```sh
cd apps/server
bun run db:encrypt
```

Idempotent — safe to re-run. Supports `--dry-run` to preview counts
without writing.

## Rotating the key

Not implemented in v1. When needed, the plan is:

1. Add `v2:` prefix support alongside `v1:`
2. Read with either version, always write `v2:`
3. Run a re-encrypt script that walks encrypted rows and rewrites
   them under the new key

Until then, treat the key as long-lived. Only rotate if you suspect
it's been leaked, and be prepared for the recovery cost.

## Threat model

**Protects against:**
- Database dumps / backups leaking (attacker gets ciphertext only)
- Read-only SQL access via support / analytics roles
- Accidentally-committed DB snapshots

**Does NOT protect against:**
- Full server compromise (attacker gets the env var + the DB)
- A malicious operator on the same machine
- Application bugs that log plaintext values

For production-grade key management, move `ENCRYPTION_KEY` into a
managed secrets store (AWS Secrets Manager, HashiCorp Vault, GCP
Secret Manager) and load at boot. This is a straightforward swap
that doesn't require re-encrypting the DB.
