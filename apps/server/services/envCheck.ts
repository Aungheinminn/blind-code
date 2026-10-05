// Required platform env vars. The product posture is that Blind Code's
// defaults are always available, so these must be set at startup. Users layer
// their own keys on top via Settings — never as the sole source.
const REQUIRED_ENV: ReadonlyArray<{ name: string; help: string }> = [
  {
    name: "ENCRYPTION_KEY",
    help: "32 bytes base64. Generate: openssl rand -base64 32",
  },
  { name: "DATABASE_URL", help: "postgres://user:pass@host:5432/db" },
  { name: "ANTHROPIC_API_KEY", help: "https://console.anthropic.com/" },
  { name: "OPENAI_API_KEY", help: "https://platform.openai.com/api-keys" },
  {
    name: "GOOGLE_GENERATIVE_AI_API_KEY",
    help: "https://aistudio.google.com/apikey",
  },
  { name: "OPENROUTER_API_KEY", help: "https://openrouter.ai/keys" },
  {
    name: "SUPABASE_ACCESS_TOKEN",
    help: "Blind Code org PAT: https://supabase.com/dashboard/account/tokens",
  },
  {
    name: "VERCEL_API_TOKEN",
    help: "Blind Code account token: https://vercel.com/account/settings/tokens",
  },
];

export const assertRequiredEnv = (): void => {
  const missing = REQUIRED_ENV.filter(({ name }) => !process.env[name]?.trim());
  if (missing.length === 0) return;

  console.error("\n[env] Missing required environment variables:\n");
  for (const { name, help } of missing) {
    console.error(`  - ${name}`);
    console.error(`      ${help}`);
  }
  console.error(
    "\nSee apps/server/.env.example. Platform keys are the default; users layer their own on top in Settings.\n",
  );
  process.exit(1);
};
