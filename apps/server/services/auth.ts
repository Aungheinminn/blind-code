export const getAgentToken = (): string | null => process.env.AGENT_TOKEN?.trim() || null;

export const extractTokenFromUrl = (url: string | undefined): string | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url, "http://localhost");
    return parsed.searchParams.get("token");
  } catch {
    return null;
  }
};

export const isAuthorized = (url: string | undefined): boolean => {
  const expected = getAgentToken();
  if (!expected) return true;
  return extractTokenFromUrl(url) === expected;
};
