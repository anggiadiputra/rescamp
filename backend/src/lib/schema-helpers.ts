import { t } from "elysia";

/**
 * A string field whose value is passed through `fn` before it reaches the
 * handler. Elysia silently ignores a `transform:` option inside `t.String({...})`,
 * so sanitizers declared that way never ran; `t.Transform(...).Decode` is the
 * mechanism Elysia actually applies to request bodies.
 *
 * Note: the base schema (minLength, format, pattern) validates the RAW value,
 * before `fn` runs — services must still validate the sanitized result.
 */
export function sanitizedString(fn: (v: string) => string, opts: Parameters<typeof t.String>[0] = {}) {
  return t.Transform(t.String(opts)).Decode((v: string) => fn(v)).Encode((v: string) => v);
}
