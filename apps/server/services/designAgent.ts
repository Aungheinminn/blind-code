import { streamText, stepCountIs, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, hasDb, schema } from "../db/client";
import { getReasoningProviderOptions, resolveModel } from "./providers";
import { parseTemplate } from "./designTemplate";
import { extractErrorMessage } from "./coder";

export type DesignAgentChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type DesignAgentEvent =
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; text: string }
  | { type: "text-end"; id: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: unknown }
  | {
      type: "tool-result";
      toolCallId: string;
      toolName: string;
      output: unknown;
    }
  | { type: "draft-updated"; markdown: string }
  | {
      type: "save-proposed";
      proposal: { name: string; description: string; markdown: string };
    }
  | { type: "step-finish"; finishReason: string }
  | { type: "finish"; finishReason: string; usage?: unknown }
  | { type: "error"; error: string };

export type RunDesignAgentOptions = {
  provider: string;
  model?: string;
  ownerUserId: string;
  prompt: string;
  history?: DesignAgentChatMessage[];
  initialDraft?: string | null;
  signal?: AbortSignal;
  onEvent: (event: DesignAgentEvent) => void;
};

const DESIGN_AGENT_SYSTEM_PROMPT = `You are a design-system template authoring agent. Your job is to produce a single, valid design template Markdown document that describes a cohesive visual voice — colors, typography, layout, elevation, shapes, components, and usage rules — and propose it to the user for saving. You never persist templates directly; the user decides whether to save via a UI popup.

Output format (STRICT):
Each template is a Markdown file with YAML frontmatter, matching the same schema used by the platform's builtin templates. Structure:

---
version: alpha
name: <Human Readable Name>
description: <One sentence — the vibe and where it fits best.>
colors:
  primary: "#RRGGBB"
  secondary: "#RRGGBB"
  tertiary: "#RRGGBB"
  neutral: "#RRGGBB"        # page/background canvas
  surface: "#RRGGBB"         # card/panel surface
  on-surface: "#RRGGBB"      # primary text on surface and neutral
  error: "#RRGGBB"
  border: "#RRGGBB"
  muted-foreground: "#RRGGBB"
typography:
  headline-lg:
    fontFamily: <family>
    fontSize: 30px
    fontWeight: 600
    lineHeight: 1.2
  headline-md: { ... }
  body-md: { ... }
  body-sm: { ... }
  label-md: { ... }
rounded:
  sm: 4px
  md: 8px
  lg: 14px
  full: 9999px
elevation:
  sm: "0 1px 2px rgba(0,0,0,0.10)"
  md: "0 3px 10px rgba(0,0,0,0.14)"
  lg: "0 12px 32px rgba(0,0,0,0.20)"
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
components:
  button-primary: { backgroundColor: "{colors.primary}", textColor: "{colors.on-surface}", rounded: "{rounded.md}", padding: 12px }
  input:          { backgroundColor: "{colors.surface}",  textColor: "{colors.on-surface}", rounded: "{rounded.md}", padding: 10px }
  card:           { backgroundColor: "{colors.surface}",  rounded: "{rounded.lg}", padding: 20px }
---

# <Template Name>

## Overview
<Paragraph on the mood, target use cases, and what makes this template distinct.>

## Colors
<Bulleted description of each color role and where it should be used.>

## Typography
<Type scale rationale, when each role is used.>

## Layout
<Spacing scale, grid, container patterns.>

## Elevation
<Depth strategy — shadows, layering, borders vs shadows.>

## Shapes
<Radius scale and shape language.>

## Components
<How each component composes tokens.>

## Do's and Don'ts
<Bulleted rules — what to embrace, what to avoid.>

Hard rules (the validator will reject you otherwise):
1. Frontmatter MUST include a non-empty "name" field.
2. The body MUST contain all 8 H2 sections above (## Overview, ## Colors, ## Typography, ## Layout, ## Elevation, ## Shapes, ## Components, ## Do's and Don'ts). If a section is deliberately omitted, list it in a frontmatter "omitted" array — but prefer writing all 8.
3. Section headings must be unique (no duplicate H2s).
4. Contrast: on-surface vs neutral AND on-surface vs surface must each pass WCAG AA (contrast ratio >= 4.5:1). Choose your palette to satisfy both pairs, or the save will be rejected.
5. Use hex colors (#RRGGBB or #RGB) in the frontmatter "colors" block — no hsl(), rgb(), oklch(), or named colors. The contrast checker only understands hex.
6. Frontmatter keys are LOCKED. The schema is strict — any unknown key rejects the draft. Use ONLY the keys listed:
   - colors: primary, secondary, tertiary, neutral, surface, on-surface, error, border, muted-foreground (all 9 required)
   - typography: headline-lg, headline-md, body-md, body-sm, label-md (all 5 required, each with fontFamily, fontSize, fontWeight; lineHeight and letterSpacing optional)
   - rounded: sm, md, lg, full (all 4 required)
   - elevation: sm, md, lg (all 3 required, CSS box-shadow strings like "0 1px 2px rgba(0,0,0,0.10)")
   - spacing: xs, sm, md, lg, xl (all 5 required)
   - components: button-primary, input, card (all 3 required, each with optional backgroundColor, textColor, borderColor, rounded, padding)
   - Do NOT invent extras like button-primary-hover, success color, headline-sm, card-elevated, etc. Encode hover behavior, extra states, or extra variants in the prose (## Components / ## Do's and Don'ts), not as extra token keys.

Your workflow:
1. Optionally call read_builtin_template with slug "paper", "nebula", or "terminal" to see reference structure. Use this ONLY if you need to remind yourself of the format — do not copy verbatim.
2. Call write_draft with your full Markdown document. This stashes the draft; the client sees a live preview.
3. Call validate_draft. It returns { ok: true } or { ok: false, error }. If it fails, revise your draft (fix the specific issue named in the error) and call write_draft again, then validate_draft. Repeat until it passes. Cap yourself at 4 revision attempts — if you can't pass after four, report the blocker in text and stop.
4. Once validate_draft returns ok, call propose_save with the "name" and a short "description" you want to save the template as. This ASKS the user for approval via a UI popup — it does NOT persist. The user decides whether to save or keep iterating. You do not save directly.
5. After calling propose_save, reply with one short sentence saying the draft is ready and stop. Do not narrate what you saved (nothing was saved yet). Do not call propose_save again in the same turn.

Prose style (important — the studio renders token refs as live chips):
- When the prose in any body section names a token you defined in the frontmatter, reference it as \`{group.key}\` (backticked). Examples: \`{colors.primary}\`, \`{colors.on-surface}\`, \`{rounded.md}\`, \`{typography.headline-lg}\`, \`{spacing.md}\`, \`{elevation.md}\`. Do NOT paraphrase these with adjectives like "the cyan fill" or "near-black text" — reference the token instead.
- The studio parses these refs and renders them as small chips (a color swatch + hex for colors, a value chip for the rest) that update automatically when the user edits the token. Adjective-only prose goes stale the moment a value changes.
- Still write in flowing prose — sentences and short paragraphs, not spec-sheet bullets. The chips are inline references INSIDE prose. Do not add \`###\` subheadings inside a section unless the content truly needs them.
- Bare descriptors are fine when they're not naming a token ("keep labels concise", "avoid drop shadows"). Only chip up what you defined in the frontmatter.

Refinement turns:
- If the user has an existing draft (visible in the conversation) and asks for a tweak ("make the accent warmer", "swap the serif for a mono headline"), start from that draft — do NOT regenerate from scratch. Call write_draft with the revised full document, then validate_draft, then propose_save.
- Do not call read_builtin_template on refinement turns unless the user explicitly changes the reference direction.

Narration:
- Before each concrete step, say one short sentence (5-15 words) about what you're about to do. Do not narrate between tool calls within the same step.
- Do not restate tool arguments or dump tool output back to the user.`;

const buildDraftAppendix = (draft: string): string =>
  `\n\nCURRENT DRAFT\n\nThe user has an in-progress draft below. Start from this on refinement turns.\n\n<draft>\n${draft}\n</draft>`;

const readBuiltinFromDb = async (
  slug: string,
): Promise<{ slug: string; name: string; content: string } | null> => {
  if (!hasDb || !db) return null;
  const rows = await db
    .select({
      slug: schema.designTemplates.slug,
      name: schema.designTemplates.name,
      content: schema.designTemplates.content,
    })
    .from(schema.designTemplates)
    .where(
      and(
        eq(schema.designTemplates.origin, "builtin"),
        eq(schema.designTemplates.slug, slug),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row || !row.slug) return null;
  return { slug: row.slug, name: row.name, content: row.content };
};

export const runDesignAgent = async (
  opts: RunDesignAgentOptions,
): Promise<void> => {
  const model = await resolveModel(opts.provider, opts.model, opts.ownerUserId);
  const reasoning = getReasoningProviderOptions(opts.provider, opts.model);

  const draftState: { markdown: string | null } = {
    markdown: opts.initialDraft?.trim() ? opts.initialDraft : null,
  };

  const emit = (event: DesignAgentEvent): void => {
    try {
      opts.onEvent(event);
    } catch {}
  };

  const tools = {
    read_builtin_template: tool({
      description:
        "Read the full markdown source of a builtin design template for reference. Valid slugs: 'paper', 'nebula', 'terminal'. Use sparingly — only when you need to remind yourself of the format.",
      inputSchema: z.object({
        slug: z
          .string()
          .describe("Builtin slug — one of 'paper', 'nebula', 'terminal'."),
      }),
      execute: async ({ slug }) => {
        const row = await readBuiltinFromDb(slug);
        if (!row) return { error: `builtin template not found: ${slug}` };
        return { slug: row.slug, name: row.name, content: row.content };
      },
    }),

    write_draft: tool({
      description:
        "Write the full markdown document as the current draft. Overwrites any prior draft. Emits a preview event to the client. Always follow with validate_draft before propose_save.",
      inputSchema: z.object({
        markdown: z
          .string()
          .describe(
            "Complete Markdown document with YAML frontmatter and all required H2 sections.",
          ),
      }),
      execute: async ({ markdown }) => {
        draftState.markdown = markdown;
        emit({ type: "draft-updated", markdown });
        return { ok: true as const, length: markdown.length };
      },
    }),

    validate_draft: tool({
      description:
        "Validate the current draft against the platform schema (frontmatter, required sections, WCAG AA contrast). Returns { ok: true } or { ok: false, error }. Call after every write_draft.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!draftState.markdown) {
          return {
            ok: false as const,
            error: "no draft yet — call write_draft first",
          };
        }
        try {
          const parsed = parseTemplate(draftState.markdown);
          return {
            ok: true as const,
            name: parsed.tokens.name,
            sections: parsed.sections,
            warnings: parsed.warnings,
          };
        } catch (err) {
          return { ok: false as const, error: extractErrorMessage(err) };
        }
      },
    }),

    propose_save: tool({
      description:
        "Ask the user to save the current validated draft. Re-validates the draft, then emits a proposal event that the client renders as a Save/Later popup — nothing is written to the database. The user decides. Do not call unless validate_draft returned ok. Call this at most ONCE per turn.",
      inputSchema: z.object({
        name: z
          .string()
          .min(1)
          .describe(
            "Human-readable template name. Should match the 'name' field in the frontmatter.",
          ),
        description: z
          .string()
          .optional()
          .describe(
            "One-sentence description shown in the template picker. Should match frontmatter 'description'.",
          ),
      }),
      execute: async ({ name, description }) => {
        if (!draftState.markdown) {
          return { error: "no draft to propose — call write_draft first" };
        }
        let parsed;
        try {
          parsed = parseTemplate(draftState.markdown);
        } catch (err) {
          return {
            error: `draft failed validation: ${extractErrorMessage(err)}`,
          };
        }
        const finalDescription =
          description ?? parsed.tokens.description ?? "";
        emit({
          type: "save-proposed",
          proposal: {
            name,
            description: finalDescription,
            markdown: draftState.markdown,
          },
        });
        return {
          status: "awaiting_user_decision" as const,
          name,
          description: finalDescription,
        };
      },
    }),
  };

  const system = draftState.markdown
    ? DESIGN_AGENT_SYSTEM_PROMPT + buildDraftAppendix(draftState.markdown)
    : DESIGN_AGENT_SYSTEM_PROMPT;

  const messages: ModelMessage[] = [
    ...(opts.history ?? []).map(
      (m) => ({ role: m.role, content: m.content }) as ModelMessage,
    ),
    { role: "user", content: opts.prompt },
  ];

  try {
    const result = streamText({
      model,
      system,
      messages,
      tools,
      stopWhen: stepCountIs(30),
      abortSignal: opts.signal,
      ...(reasoning.providerOptions
        ? { providerOptions: reasoning.providerOptions }
        : {}),
      ...(reasoning.maxOutputTokens
        ? { maxOutputTokens: reasoning.maxOutputTokens }
        : {}),
    });

    for await (const chunk of result.fullStream) {
      switch (chunk.type) {
        case "text-start" as any:
          emit({ type: "text-start", id: (chunk as any).id });
          break;
        case "text-delta":
          emit({
            type: "text-delta",
            id: (chunk as any).id,
            text: (chunk as any).text ?? (chunk as any).delta ?? "",
          });
          break;
        case "text-end" as any:
          emit({ type: "text-end", id: (chunk as any).id });
          break;
        case "reasoning-start" as any:
        case "reasoning-delta" as any:
        case "reasoning-end" as any:
          break;
        case "tool-call":
          emit({
            type: "tool-call",
            toolCallId: (chunk as any).toolCallId,
            toolName: (chunk as any).toolName,
            input: (chunk as any).input ?? (chunk as any).args,
          });
          break;
        case "tool-result":
          emit({
            type: "tool-result",
            toolCallId: (chunk as any).toolCallId,
            toolName: (chunk as any).toolName,
            output: (chunk as any).output ?? (chunk as any).result,
          });
          break;
        case "finish-step":
        case "step-finish" as any:
          emit({
            type: "step-finish",
            finishReason: (chunk as any).finishReason ?? "unknown",
          });
          break;
        case "finish":
          emit({
            type: "finish",
            finishReason: (chunk as any).finishReason ?? "unknown",
            usage: (chunk as any).usage,
          });
          break;
        case "error":
          emit({
            type: "error",
            error: extractErrorMessage((chunk as any).error),
          });
          break;
      }
    }
  } catch (err) {
    if (opts.signal?.aborted) return;
    emit({ type: "error", error: extractErrorMessage(err) });
  }
};
