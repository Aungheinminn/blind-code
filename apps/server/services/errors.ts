export type FriendlyErrorOptions = {
  entity?: string;
  field?: string;
};

const cap = (s: string): string =>
  s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;

export const friendlyError = (
  err: unknown,
  opts: FriendlyErrorOptions = {},
): string => {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "unknown error";
  const entity = opts.entity ?? "record";
  const field = opts.field ?? "field";

  const lengthMatch =
    /value too long for type character varying\((\d+)\)/i.exec(raw);
  if (lengthMatch) {
    return `${cap(field)} is too long — keep it under ${lengthMatch[1]} characters.`;
  }

  if (/duplicate key value violates unique constraint/i.test(raw)) {
    return `Another ${entity} with that ${field} already exists.`;
  }

  if (/foreign key constraint/i.test(raw)) {
    return `Cannot delete this ${entity} — it's still referenced by other data.`;
  }

  const nullMatch =
    /null value in column "([^"]+)".*violates not-null constraint/i.exec(raw);
  if (nullMatch) {
    const col = nullMatch[1].replace(/_/g, " ");
    return `${cap(col)} is required.`;
  }

  if (/connection.*terminated|econnrefused|econnreset/i.test(raw)) {
    return `Could not reach the database. Try again in a moment.`;
  }

  return raw;
};
