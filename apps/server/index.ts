import { assertRequiredEnv } from "./services/envCheck";

assertRequiredEnv();

import { createApp } from "./app";
import { hasDb } from "./db/client";
import { turnBus } from "./services/turnBus";
import { seedBuiltinDesignTemplates } from "./services/designTemplateSeeder";

if (hasDb) {
  const swept = await turnBus.sweepOrphanedRunning(0).catch((e) => {
    console.warn("[db] sweepOrphanedRunning failed:", e);
    return 0;
  });
  if (swept > 0) console.log(`[db] marked ${swept} orphaned running turn(s) as failed`);

  const seeded = await seedBuiltinDesignTemplates();
  console.log(`[design-templates] seeded ${seeded} builtin(s)`);
}

createApp().listen(3001);

console.log("Server listening on http://localhost:3001");
