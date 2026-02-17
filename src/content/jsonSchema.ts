import type { ContentKind } from "./schemas";
import type { ContentRegistry } from "./validation";

import { contentSchemas } from "./schemas";

export type JsonSchema = Record<string, unknown>;

const cloneSchema = (schema: JsonSchema): JsonSchema =>
  JSON.parse(JSON.stringify(schema)) as JsonSchema;

const getProperties = (
  schema: JsonSchema,
): null | Record<string, JsonSchema> => {
  const props = (schema as { properties?: Record<string, JsonSchema> })
    .properties;
  return props ?? null;
};

const getItemsSchema = (schema: JsonSchema): JsonSchema => {
  const items = (schema as { items?: JsonSchema }).items;
  if (items && typeof items === "object") return items;
  return {};
};

const getUnionOptions = (schema: JsonSchema): JsonSchema[] => {
  const anyOf = (schema as { anyOf?: JsonSchema[] }).anyOf;
  if (anyOf?.length) return anyOf;
  const oneOf = (schema as { oneOf?: JsonSchema[] }).oneOf;
  if (oneOf?.length) return oneOf;
  return [];
};

const setEnumOnArrayItems = (schema: JsonSchema, values: string[]): void => {
  const items = getItemsSchema(schema) as { enum?: string[] };
  items.enum = values;
};

const setEnumOnProperty = (schema: JsonSchema, values: string[]): void => {
  (schema as { enum?: string[] }).enum = values;
};

const removeRequiredProperty = (schema: JsonSchema, property: string): void => {
  const required = (schema as { required?: string[] }).required;
  if (!required || !Array.isArray(required)) return;
  (schema as { required?: string[] }).required = required.filter(
    (entry) => entry !== property,
  );
};

export const buildJsonSchemaForKind = (
  kind: ContentKind,
  registry?: ContentRegistry,
): JsonSchema => {
  const baseSchema = contentSchemas[kind].toJSONSchema({
    reused: "inline",
    target: "draft-07",
  }) as JsonSchema;
  const schema = cloneSchema(baseSchema);

  const props = getProperties(schema);
  if (!props) return schema;

  if (kind === "ships" && props.mounts) {
    const mountItem = getItemsSchema(props.mounts);
    removeRequiredProperty(mountItem, "modSlots");
  }

  if (!registry) return schema;

  if (kind === "waves") {
    const spawns = getItemsSchema(props.spawns ?? {});
    const spawnProps = getProperties(spawns);
    if (spawnProps?.enemyId) {
      setEnumOnProperty(spawnProps.enemyId, Object.keys(registry.enemiesById));
    }
  }

  if (kind === "levels") {
    if (props.waveIds) {
      setEnumOnArrayItems(props.waveIds, Object.keys(registry.wavesById));
    }
    if (props.hazardIds) {
      setEnumOnArrayItems(props.hazardIds, Object.keys(registry.hazardsById));
    }
    if (props.shopId) {
      setEnumOnProperty(props.shopId, Object.keys(registry.shopsById));
    }
    if (props.objectiveSetId) {
      setEnumOnProperty(
        props.objectiveSetId,
        Object.keys(registry.objectivesById),
      );
    }
    if (props.preBeatId) {
      setEnumOnProperty(props.preBeatId, Object.keys(registry.beatsById));
    }
    if (props.postBeatId) {
      setEnumOnProperty(props.postBeatId, Object.keys(registry.beatsById));
    }

    if (props.winCondition) {
      const winOptions = getUnionOptions(props.winCondition);
      const bossOption = winOptions.find((option) => {
        const optionProps = getProperties(option);
        return (
          optionProps?.kind &&
          (optionProps.kind as { const?: string }).const === "defeatBoss"
        );
      });
      const bossProps = bossOption ? getProperties(bossOption) : null;
      if (bossProps?.bossId) {
        setEnumOnProperty(bossProps.bossId, Object.keys(registry.enemiesById));
      }
    }

    if (props.endCondition) {
      const endOptions = getUnionOptions(props.endCondition);
      const bossOption = endOptions.find((option) => {
        const optionProps = getProperties(option);
        return (
          optionProps?.kind &&
          (optionProps.kind as { const?: string }).const === "defeatBoss"
        );
      });
      const bossProps = bossOption ? getProperties(bossOption) : null;
      if (bossProps?.bossId) {
        setEnumOnProperty(bossProps.bossId, Object.keys(registry.enemiesById));
      }
    }
  }

  if (kind === "galaxies" && props.levels) {
    const levelItem = getItemsSchema(props.levels);
    const levelProps = getProperties(levelItem);
    if (levelProps?.levelId) {
      setEnumOnProperty(levelProps.levelId, Object.keys(registry.levelsById));
    }
  }

  if (kind === "shops") {
    if (props.allowedWeapons) {
      setEnumOnArrayItems(
        props.allowedWeapons,
        Object.keys(registry.weaponsById),
      );
    }
    if (props.allowedMods) {
      setEnumOnArrayItems(props.allowedMods, Object.keys(registry.modsById));
    }
    if (props.allowedShips) {
      setEnumOnArrayItems(props.allowedShips, Object.keys(registry.shipsById));
    }
  }

  if (kind === "weapons") {
    if (props.gunId) {
      setEnumOnProperty(props.gunId, Object.keys(registry.gunsById));
    }
  }

  return schema;
};
