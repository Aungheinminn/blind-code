import { mkdtemp, readFile, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  authFilePath,
  getStoredKey,
  last4,
  readAuth,
  removeStoredKey,
  setStoredKey,
} from "../services/authStore";

const tmp = await mkdtemp(join(tmpdir(), "blind-code-auth-"));
const file = join(tmp, "nested", "auth.json");
process.env.BLIND_CODE_AUTH_FILE = file;

console.log("auth file:", authFilePath());

const empty = await readAuth();
console.log("initial read (missing file):", empty);

await setStoredKey("anthropic", "  sk-ant-testkey1234  ");
await setStoredKey("openai", "sk-openai-abcd");

const st = await stat(file);
console.log("mode (want 0600):", (st.mode & 0o777).toString(8));

const parentSt = await stat(join(tmp, "nested"));
console.log("dir mode (want 0700):", (parentSt.mode & 0o777).toString(8));

const stored = await readAuth();
console.log("after writes:", JSON.stringify(stored, null, 2));

console.log("getStoredKey anthropic:", await getStoredKey("anthropic"));
console.log("last4 mask:", last4((await getStoredKey("anthropic"))!));

const removed = await removeStoredKey("openai");
console.log("removed openai:", removed);
console.log("openai after remove:", await getStoredKey("openai"));

try {
  await setStoredKey("anthropic", "   ");
  console.log("FAIL: empty key should have thrown");
} catch (e) {
  console.log("empty key rejected as expected:", (e as Error).message);
}

const raw = await readFile(file, "utf-8");
console.log("\nfinal file contents:\n" + raw);

await rm(tmp, { recursive: true, force: true });
console.log("\ncleaned up");
process.exit(0);
