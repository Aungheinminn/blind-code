// Infrastructure vars the server can't run without. Platform provider keys
// (ANTHROPIC_API_KEY, OPENAI_API_KEY, …) are intentionally NOT in here — any
// provider without a platform key just means users must bring their own key
// for that provider via Settings.
const REQUIRED_ENV: ReadonlyArray<{ name: string; help: string }> = [
  {
    name: "ENCRYPTION_KEY",
    help: "32 bytes base64. Generate: openssl rand -base64 32",
  },
  { name: "DATABASE_URL", help: "postgres://user:pass@host:5432/db" },
  {
    name: "SUPABASE_ACCESS_TOKEN",
    help: "Blind Code org PAT: https://supabase.com/dashboard/account/tokens",
  },
  {
    name: "VERCEL_API_TOKEN",
    help: "Blind Code account token: https://vercel.com/account/settings/tokens",
  },
];

const PROVIDER_ENV: ReadonlyArray<string> = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "OPENROUTER_API_KEY",
];

export const assertRequiredEnv = (): void => {
  const missing = REQUIRED_ENV.filter(({ name }) => !process.env[name]?.trim());
  if (missing.length > 0) {
    console.error("\n[env] Missing required environment variables:\n");
    for (const { name, help } of missing) {
      console.error(`  - ${name}`);
      console.error(`      ${help}`);
    }
    console.error("\nSee apps/server/.env.example.\n");
    process.exit(1);
  }

  const providersMissing = PROVIDER_ENV.filter((name) => !process.env[name]?.trim());
  if (providersMissing.length === PROVIDER_ENV.length) {
    console.warn(
      "\n[env] No platform provider keys set. Users must bring their own key in Settings → Providers for any provider they want to use.\n",
    );
  } else if (providersMissing.length > 0) {
    console.warn(
      `[env] No platform key for: ${providersMissing.join(", ")} — users must bring their own for those providers.`,
    );
  }
};
