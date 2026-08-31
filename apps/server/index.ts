import { Elysia } from "elysia";
import { Orchestrator } from "./services/orchestrator";
import { runtimeWsController } from "./controllers/runtime.ws";
import { projectController } from "./controllers/project.controller";
import { agentController } from "./controllers/agent.ws";
import { ensureLocalUser } from "./db/repo";
import { hasDb } from "./db/client";

if (hasDb) {
  await ensureLocalUser().catch((e) => console.warn("[db] ensureLocalUser failed:", e));
}

const app = new Elysia();
const orchestrator = new Orchestrator();

projectController(app);
runtimeWsController(app, orchestrator);
agentController(app);

app.get("/health", () => ({ status: "ok" }));

app.listen(3001);

console.log("Server listening on http://localhost:3001");
