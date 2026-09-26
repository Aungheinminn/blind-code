import { hasDb } from "../db/client";
import { seedBuiltinDesignTemplates } from "../services/designTemplateSeeder";

if (!hasDb) {
  console.error("[seed] DATABASE_URL not set");
  process.exit(1);
}

const count = await seedBuiltinDesignTemplates();
console.log(`[seed] upserted ${count} builtin design template(s)`);
process.exit(0);
