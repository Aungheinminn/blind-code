import { Elysia } from "elysia";
import { Orchestrator } from "./services/orchestrator";
import { runtimeWsController } from "./controllers/runtime.ws";
import { projectController } from "./controllers/project.controller";
import { agentController } from "./controllers/agent.ws";
import { authController } from "./controllers/auth.controller";
import { hasDb } from "./db/client";
import { turnBus } from "./services/turnBus";
import { withCors } from "./services/cors";

if (hasDb) {
  const swept = await turnBus.sweepOrphanedRunning(0).catch((e) => {
    console.warn("[db] sweepOrphanedRunning failed:", e);
    return 0;
  });
  if (swept > 0) console.log(`[db] marked ${swept} orphaned running turn(s) as failed`);
}

const app = new Elysia();
const orchestrator = new Orchestrator();

withCors(app);
authController(app);
projectController(app);
runtimeWsController(app, orchestrator);
agentController(app);

app.get("/health", () => ({ status: "ok" }));

app.listen(3001);

console.log("Server listening on http://localhost:3001");
