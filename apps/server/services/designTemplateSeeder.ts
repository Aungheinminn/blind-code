import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { db, hasDb, schema } from "../db/client";
import { parseTemplate } from "./designTemplate";

const TEMPLATES_DIR = resolve(import.meta.dir, "..", "design-templates");

const BUILTIN_SORT_ORDER: Record<string, number> = {
  paper: 0,
  nebula: 1,
  terminal: 2,
};

export const seedBuiltinDesignTemplates = async (): Promise<number> => {
  if (!hasDb || !db) {
    console.warn(
      "[design-templates] DATABASE_URL not set — skipping builtin seeder",
    );
    return 0;
  }

  const entries = await readdir(TEMPLATES_DIR);
  const mdFiles = entries.filter((f) => f.endsWith(".md"));
  if (mdFiles.length === 0) {
    throw new Error(`No builtin templates found in ${TEMPLATES_DIR}`);
  }

  let count = 0;
  for (const file of mdFiles) {
    const slug = file.replace(/\.md$/, "");
    const path = join(TEMPLATES_DIR, file);
    const source = await readFile(path, "utf8");

    let parsed;
    try {
      parsed = parseTemplate(source);
    } catch (err) {
      throw new Error(
        `Builtin template ${file} failed validation: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    const sortOrder = BUILTIN_SORT_ORDER[slug] ?? 100;

    await db
      .insert(schema.designTemplates)
      .values({
        slug,
        name: parsed.tokens.name,
        description: parsed.tokens.description ?? null,
        content: source,
        parsedTokens: parsed.tokens,
        origin: "builtin",
        isReadOnly: true,
        sortOrder,
      })
      .onConflictDoUpdate({
        target: schema.designTemplates.slug,
        set: {
          name: parsed.tokens.name,
          description: parsed.tokens.description ?? null,
          content: source,
          parsedTokens: parsed.tokens,
          sortOrder,
          updatedAt: sql`now()`,
        },
      });
    count += 1;
  }

  return count;
};
