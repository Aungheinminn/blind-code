import { Elysia } from "elysia";
import { Orchestrator } from "./services/orchestrator";
import { runtimeWsController } from "./controllers/runtime.ws";
import { projectController } from "./controllers/project.controller";
import { agentController } from "./controllers/agent.ws";
import { authController } from "./controllers/auth.controller";
import { connectController } from "./controllers/connect.controller";
import { accountController } from "./controllers/account.controller";
import { sampleBuildsController } from "./controllers/sampleBuilds.controller";
import { designTemplatesController } from "./controllers/designTemplates.controller";
import { hasDb } from "./db/client";
import { turnBus } from "./services/turnBus";
import { withCors } from "./services/cors";
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

const app = new Elysia();
const orchestrator = new Orchestrator();

app.onError(({ error, code, set }) => {
  if (code === "VALIDATION") return;
  if (code === "NOT_FOUND") {
    set.status = 404;
    return { error: "not found" };
  }
  if (set.status == null || set.status === 200) set.status = 500;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[error] ${code} ${set.status}: ${message}`);
  return { error: message };
});

withCors(app);
authController(app);
projectController(app);
sampleBuildsController(app);
designTemplatesController(app);
runtimeWsController(app, orchestrator);
agentController(app);
connectController(app);
accountController(app);

app.get("/health", () => ({ status: "ok" }));

app.listen(3001);

console.log("Server listening on http://localhost:3001");
