import { getUserById } from "../db/repo";

// No platform fallback: pushing user code to a Blind Code-owned account
// would make no sense, so GitHub is user-token only.
export const resolveGitHubToken = async (
  userId: string | null | undefined,
): Promise<string | null> => {
  if (!userId) return null;
  const user = await getUserById(userId);
  const tok = user?.integrations?.github?.accessToken?.trim();
  return tok ? tok : null;
};
