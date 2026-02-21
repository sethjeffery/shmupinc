import type { ContentKind } from "./schemas";
import type { ContentRegistry } from "./validation";

type ReferencePickerMode = "array" | "single";

export interface ReferencePicker {
  contentKind: ContentKind;
  key: string;
  label: string;
  mode: ReferencePickerMode;
  registryKey: keyof ContentRegistry;
}

export const REFERENCE_PICKERS: ReferencePicker[] = [
  {
    contentKind: "waves",
    key: "waveIds",
    label: "Wave",
    mode: "array",
    registryKey: "wavesById",
  },
  {
    contentKind: "hazards",
    key: "hazardIds",
    label: "Hazard",
    mode: "array",
    registryKey: "hazardsById",
  },
  {
    contentKind: "shops",
    key: "shopId",
    label: "Shop",
    mode: "single",
    registryKey: "shopsById",
  },
  {
    contentKind: "objectives",
    key: "objectiveSetId",
    label: "Objectives",
    mode: "single",
    registryKey: "objectivesById",
  },
  {
    contentKind: "guns",
    key: "gunId",
    label: "Gun",
    mode: "single",
    registryKey: "gunsById",
  },
];
