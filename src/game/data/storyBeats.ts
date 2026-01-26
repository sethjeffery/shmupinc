import type { StoryBeat } from "./storyBeatTypes";

import { getContentRegistry } from "../../content/registry";

export type { StoryBeat } from "./storyBeatTypes";

export const STORY_BEATS: Record<string, StoryBeat> =
  getContentRegistry().beatsById;
