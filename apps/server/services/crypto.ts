import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const HELP =
  "Generate one with:\n" +
  "    openssl rand -base64 32\n" +
  "Then add to apps/server/.env:\n" +
  "    ENCRYPTION_KEY=<paste output>";

const raw = process.env.ENCRYPTION_KEY?.trim();
if (!raw) {
  throw new Error(`ENCRYPTION_KEY env var is required.\n${HELP}`);
}
const key = Buffer.from(raw, "base64");
if (key.length !== 32) {
  throw new Error(
    `ENCRYPTION_KEY must decode from base64 to exactly 32 bytes (got ${key.length}).\n${HELP}`,
  );
}

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const VERSION = "v1";

export const encrypt = (plain: string): string => {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}:${ct.toString("base64")}:${tag.toString("base64")}`;
};

export const isEncrypted = (value: string): boolean => value.startsWith(`${VERSION}:`);

export const decrypt = (payload: string): string => {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error(`Unknown encrypted payload format: ${parts[0]}`);
  }
  const iv = Buffer.from(parts[1], "base64");
  const ct = Buffer.from(parts[2], "base64");
  const tag = Buffer.from(parts[3], "base64");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plain.toString("utf8");
};

export const decryptMaybe = (
  value: string | null | undefined,
): string | null => {
  if (value == null || value === "") return null;
  if (!isEncrypted(value)) return value;
  return decrypt(value);
};
