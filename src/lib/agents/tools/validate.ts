import { z, type ZodType } from "zod";
import type { ToolDefinition } from "./types";

/**
 * Tool input validation. Every tool declares a JSON Schema for the model; the same schema is turned into a Zod
 * schema here and every call's input is checked against it before policy or execution sees it. A call that does not
 * match goes back to the model as a failed tool result that says what is wrong, so it can fix the call.
 *
 * Only the JSON Schema subset the tools use is understood (object, string, number, integer, boolean, array, enum).
 * Anything else is accepted as-is rather than rejected, so an unusual schema cannot block a tool.
 */

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
};

function toZod(schema: JsonSchema | undefined): ZodType {
  if (!schema || typeof schema !== "object") return z.unknown();
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const values = schema.enum;
    return z.unknown().refine((value) => values.includes(value), { message: `must be one of: ${values.map((v) => JSON.stringify(v)).join(", ")}` });
  }
  const type = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (type.length > 1) return z.union(type.map((t) => toZod({ ...schema, type: t })) as [ZodType, ZodType, ...ZodType[]]);
  switch (type[0]) {
    case "string":
      return z.string();
    case "number":
    case "integer": {
      // Models sometimes send numbers as strings ("5"); accept those, the tools read them with Number().
      let num = z.coerce.number();
      if (type[0] === "integer") num = num.int();
      if (typeof schema.minimum === "number") num = num.min(schema.minimum);
      if (typeof schema.maximum === "number") num = num.max(schema.maximum);
      return num;
    }
    case "boolean":
      return z.boolean();
    case "array": {
      let arr = z.array(toZod(schema.items));
      if (typeof schema.minItems === "number") arr = arr.min(schema.minItems);
      if (typeof schema.maxItems === "number") arr = arr.max(schema.maxItems);
      return arr;
    }
    case "object":
      return objectSchema(schema);
    default:
      return z.unknown();
  }
}

function objectSchema(schema: JsonSchema): ZodType {
  const required = new Set(schema.required ?? []);
  const shape: Record<string, ZodType> = {};
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    const inner = toZod(prop);
    // A missing optional field is fine; so is an explicit null, which models send for "not set".
    shape[key] = required.has(key) ? inner : inner.nullish();
  }
  // Extra fields are passed through: older field names (e.g. `task` for `objective`) are still read by some tools.
  return z.looseObject(shape);
}

const cache = new WeakMap<ToolDefinition, ZodType>();

export function inputSchemaFor(definition: ToolDefinition): ZodType {
  let schema = cache.get(definition);
  if (!schema) {
    schema = objectSchema(definition.input_schema as JsonSchema);
    cache.set(definition, schema);
  }
  return schema;
}

export type InputCheck = { ok: true } | { ok: false; error: string };

/** Check one call's input against its tool's schema. Required strings must also not be blank. */
export function validateToolInput(definition: ToolDefinition, input: unknown): InputCheck {
  const result = inputSchemaFor(definition).safeParse(input);
  const problems = result.success
    ? []
    : result.error.issues.slice(0, 5).map((issue) => `${issue.path.length ? issue.path.join(".") : "input"}: ${issue.message}`);
  for (const key of definition.input_schema.required ?? []) {
    const value = (input as Record<string, unknown> | null)?.[key];
    if (typeof value === "string" && !value.trim() && !problems.some((p) => p.startsWith(`${key}:`))) problems.push(`${key}: must not be empty`);
  }
  if (problems.length === 0) return { ok: true };
  return { ok: false, error: `Invalid input for ${definition.name}: ${problems.join("; ")}. Fix the arguments and call it again.` };
}
