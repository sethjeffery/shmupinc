import type { JsonSchema } from "./jsonSchema";

import traverse from "json-schema-traverse";

export interface SchemaExplorerEntry {
  defaultValue?: string;
  description?: string;
  path: string;
  type: string;
}

const formatDefault = (value: unknown): string | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") return "function";
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > 80) return `${serialized.slice(0, 77)}...`;
    return serialized;
  } catch {
    return "unserializable";
  }
};

const mergeTypeLabels = (left: string, right: string): string => {
  if (!left) return right;
  if (!right) return left;
  const parts = new Set([...left.split(" | "), ...right.split(" | ")]);
  return Array.from(parts).join(" | ");
};

const decodePointerSegment = (value: string): string =>
  value.replace(/~1/g, "/").replace(/~0/g, "~");

const isNumberSegment = (value: string): boolean => /^\d+$/.test(value);

const pointerToPath = (jsonPtr: string): string => {
  if (!jsonPtr) return "";
  const rawSegments = jsonPtr
    .split("/")
    .slice(1)
    .map((segment) => decodePointerSegment(segment));

  const tokens: string[] = [];
  for (let i = 0; i < rawSegments.length; i += 1) {
    const segment = rawSegments[i];
    if (segment === "properties") {
      const key = rawSegments[i + 1];
      if (key) {
        tokens.push(key);
        i += 1;
      }
      continue;
    }
    if (segment === "items") {
      if (tokens.length === 0) {
        tokens.push("[]");
      } else {
        const last = tokens.length - 1;
        tokens[last] = `${tokens[last]}[]`;
      }
      continue;
    }
    if (segment === "additionalProperties") {
      if (tokens.length === 0) {
        tokens.push("*");
      } else {
        const last = tokens.length - 1;
        tokens[last] = `${tokens[last]}.*`;
      }
      continue;
    }
    if (segment === "patternProperties") {
      const key = rawSegments[i + 1];
      if (key) {
        if (tokens.length === 0) {
          tokens.push("*");
        } else {
          const last = tokens.length - 1;
          tokens[last] = `${tokens[last]}.*`;
        }
        i += 1;
      }
      continue;
    }
    if (
      segment === "allOf" ||
      segment === "anyOf" ||
      segment === "oneOf" ||
      segment === "$defs" ||
      segment === "definitions" ||
      segment === "dependentSchemas" ||
      segment === "else" ||
      segment === "if" ||
      segment === "not" ||
      segment === "then"
    ) {
      const next = rawSegments[i + 1];
      if (next && isNumberSegment(next)) {
        i += 1;
      }
      continue;
    }
    if (isNumberSegment(segment)) {
      continue;
    }
  }

  return tokens.join(".");
};

const asSchemaArray = (value: unknown): JsonSchema[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is JsonSchema => Boolean(entry) && typeof entry === "object",
  );
};

const formatType = (schema: JsonSchema): string => {
  const enumValues = (schema as { enum?: unknown[] }).enum;
  if (Array.isArray(enumValues) && enumValues.length > 0) {
    return enumValues.map((value) => JSON.stringify(value)).join(" | ");
  }

  const constValue = (schema as { const?: unknown }).const;
  if (constValue !== undefined) {
    return JSON.stringify(constValue);
  }

  const explicitType = (schema as { type?: string | string[] }).type;
  if (Array.isArray(explicitType)) {
    return explicitType.join(" | ");
  }

  if (typeof explicitType === "string") {
    if (explicitType === "array") {
      const items = (schema as { items?: unknown }).items;
      if (items && typeof items === "object" && !Array.isArray(items)) {
        return `${formatType(items as JsonSchema)}[]`;
      }
      return "array";
    }
    return explicitType;
  }

  let unionType = "";
  for (const keyword of ["anyOf", "oneOf", "allOf"] as const) {
    const options = asSchemaArray((schema as Record<string, unknown>)[keyword]);
    for (const option of options) {
      unionType = mergeTypeLabels(unionType, formatType(option));
    }
  }
  if (unionType) return unionType;

  const items = (schema as { items?: unknown }).items;
  if (items && typeof items === "object" && !Array.isArray(items)) {
    return `${formatType(items as JsonSchema)}[]`;
  }

  const properties = (schema as { properties?: unknown }).properties;
  if (properties && typeof properties === "object") {
    return "object";
  }

  const additionalProperties = (schema as { additionalProperties?: unknown })
    .additionalProperties;
  if (additionalProperties) {
    return "record";
  }

  return "unknown";
};

export const buildSchemaExplorer = (
  schema: JsonSchema,
): SchemaExplorerEntry[] => {
  const entries = new Map<string, SchemaExplorerEntry>();

  const addEntry = (entry: SchemaExplorerEntry): void => {
    const existing = entries.get(entry.path);
    if (!existing) {
      entries.set(entry.path, entry);
      return;
    }
    existing.type = mergeTypeLabels(existing.type, entry.type);
    existing.description = existing.description ?? entry.description;
    existing.defaultValue = existing.defaultValue ?? entry.defaultValue;
  };

  traverse(schema, (currentSchema: JsonSchema, jsonPtr: string) => {
    const path = pointerToPath(jsonPtr);
    if (!path) return;
    const description =
      typeof currentSchema.description === "string"
        ? currentSchema.description
        : undefined;
    addEntry({
      defaultValue: formatDefault(
        (currentSchema as { default?: unknown }).default,
      ),
      description,
      path,
      type: formatType(currentSchema),
    });
  });

  return Array.from(entries.values()).sort((left, right) =>
    left.path.localeCompare(right.path),
  );
};
