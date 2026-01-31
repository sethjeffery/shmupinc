import { z } from "zod";

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

const resolveDefault = (value: unknown): unknown => {
  if (typeof value === "function") {
    return (value as () => unknown)();
  }
  return value;
};

interface ZodDef {
  defaultValue?: unknown;
  element?: z.ZodTypeAny;
  entries?: Record<string, string>;
  innerType?: z.ZodTypeAny;
  options?: z.ZodTypeAny[];
  shape?: Record<string, z.ZodTypeAny>;
  type: string;
  valueType?: z.ZodTypeAny;
  values?: unknown[];
}

const unwrapSchema = (
  schema: z.ZodTypeAny,
): { defaultValue?: unknown; description?: string; schema: z.ZodTypeAny } => {
  let current = schema;
  let defaultValue: unknown = undefined;
  let description = schema.description;

  while (current.type === "default") {
    const def = current._def as ZodDef;
    if (defaultValue === undefined) {
      defaultValue = resolveDefault(def.defaultValue);
    }
    current = def.innerType ?? current;
    description = description ?? current.description;
  }

  while (current.type === "optional" || current.type === "nullable") {
    const def = current._def as ZodDef;
    current = def.innerType ?? current;
    description = description ?? current.description;
  }

  return { defaultValue, description, schema: current };
};

const formatType = (schema: z.ZodTypeAny): string => {
  const def = schema._def as ZodDef;
  switch (schema.type) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "literal":
      return JSON.stringify(def.values?.[0]);
    case "enum":
      return Object.values(def.entries ?? {})
        .map((value) => JSON.stringify(value))
        .join(" | ");
    case "array":
      return `${formatType(def.element ?? z.unknown())}[]`;
    case "object":
      return "object";
    case "union":
      return (def.options ?? [])
        .map((option) => formatType(option))
        .join(" | ");
    case "record":
      return "record";
    case "any":
      return "any";
    case "unknown":
      return "unknown";
    default:
      return "unknown";
  }
};

const getShape = (schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> => {
  const def = schema._def as ZodDef;
  if (def.shape && typeof def.shape === "object") {
    return def.shape;
  }
  return {};
};

export const buildSchemaExplorer = (
  schema: z.ZodTypeAny,
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

  const walk = (current: z.ZodTypeAny, path: string): void => {
    const { defaultValue, description, schema: base } = unwrapSchema(current);
    const typeLabel = formatType(base);
    if (path) {
      addEntry({
        defaultValue: formatDefault(defaultValue),
        description,
        path,
        type: typeLabel,
      });
    }

    if (base.type === "object") {
      const shape = getShape(base);
      for (const [key, value] of Object.entries(shape)) {
        const nextPath = path ? `${path}.${key}` : key;
        walk(value, nextPath);
      }
      return;
    }

    if (base.type === "array") {
      const def = base._def as ZodDef;
      const nextPath = path ? `${path}[]` : "[]";
      if (def.element) {
        walk(def.element, nextPath);
      }
      return;
    }

    if (base.type === "union") {
      const def = base._def as ZodDef;
      for (const option of def.options ?? []) {
        walk(option, path);
      }
    }

    if (base.type === "record") {
      const def = base._def as ZodDef;
      const nextPath = path ? `${path}.*` : "*";
      if (def.valueType) {
        walk(def.valueType, nextPath);
      }
    }
  };

  walk(schema, "");

  return Array.from(entries.values());
};
