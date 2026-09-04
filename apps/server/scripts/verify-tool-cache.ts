import { buildAgentTools } from "../services/tools";
import { createAgentSession, ensureProject } from "../db/repo";
import { db, schema } from "../db/client";
import { eq } from "drizzle-orm";
import { ensureVerifyUser } from "./_verify-user";

const ownerId = await ensureVerifyUser();
const project = await ensureProject("cache-verify", ownerId);
if (!project) throw new Error("no db");
const sessionId = await createAgentSession(project.id, "test/verify");
if (!sessionId) throw new Error("no session");

const tools = buildAgentTools({
  sandboxProjectId: "cache-verify",
  dbProjectId: project.id,
  sessionId,
});

const toolCallId = `verify-${Date.now()}`;
const cmd = { command: ["node", "-e", "console.log(Date.now())"] };

const first = await tools.run_command.execute!(cmd, { toolCallId } as any);
await new Promise((r) => setTimeout(r, 20));
const second = await tools.run_command.execute!(cmd, { toolCallId } as any);

console.log("first  stdout:", (first as any).stdout.trim());
console.log("second stdout:", (second as any).stdout.trim());
console.log("cache hit:", (first as any).stdout === (second as any).stdout);

const differentId = `${toolCallId}-different`;
const third = await tools.run_command.execute!(cmd, { toolCallId: differentId } as any);
console.log("third  stdout:", (third as any).stdout.trim(), "(different toolCallId, expect NEW)");
console.log("third executed fresh:", (third as any).stdout !== (first as any).stdout);

const rows = await db!
  .select()
  .from(schema.toolCallCache)
  .where(eq(schema.toolCallCache.sessionId, sessionId));
console.log(`\n${rows.length} rows in tool_call_cache for this session:`);
for (const r of rows) console.log(" ", r.toolCallId, r.toolName, r.inputHash.slice(0, 12));

process.exit(0);
