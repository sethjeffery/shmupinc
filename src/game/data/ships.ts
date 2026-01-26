import type { ShipDefinition, ShipId } from "./shipTypes";

import { getContentRegistry } from "../../content/registry";

export const SHIPS: Record<string, ShipDefinition> =
  getContentRegistry().shipsById;

export const STARTER_SHIP_ID: ShipId = "starter";

export type { ShipDefinition, ShipId, ShipShape } from "./shipTypes";
