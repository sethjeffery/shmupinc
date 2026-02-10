import type { ObjectiveSetDefinition } from "./objectiveTypes";

import { getContentRegistry } from "../../content/registry";

export const OBJECTIVE_SETS: Record<string, ObjectiveSetDefinition> =
  getContentRegistry().objectivesById;
