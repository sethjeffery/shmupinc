import type { StoryBeat } from "./storyBeatTypes";

import { getContentRegistry } from "../../content/registry";

export type { StoryBeat } from "./storyBeatTypes";

const LEGACY_BEATS: Record<string, StoryBeat> = {
  beat_squeeze_post: {
    id: "beat_squeeze_post",
    lines: [
      "Corridor pressure normalized.",
      "Sector cleared. Return to hangar when ready.",
    ],
    title: "Clear",
  },
  beat_squeeze_pre: {
    id: "beat_squeeze_pre",
    lines: [
      "Corridor geometry is tightening ahead.",
      "Safe lanes will squeeze. Keep moving and stay light.",
    ],
    title: "Mission Brief",
  },
};

const contentBeats = getContentRegistry().beatsById;

export const STORY_BEATS: Record<string, StoryBeat> =
  Object.keys(contentBeats).length > 0 ? contentBeats : LEGACY_BEATS;
