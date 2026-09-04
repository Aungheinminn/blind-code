import { createUser, findUserByEmail } from "../db/repo";

const VERIFY_EMAIL = "verify@vibe-code.dev";

export const ensureVerifyUser = async (): Promise<string> => {
  const existing = await findUserByEmail(VERIFY_EMAIL);
  if (existing) return existing.id;
  const created = await createUser(VERIFY_EMAIL, "Verify", "!disabled!");
  if (!created) throw new Error("failed to create verify user");
  return created.id;
};
