import type { StoryBeat } from "./storyBeatTypes";

import { getContentRegistry } from "../../content/registry";

export const STORY_BEATS: Record<string, StoryBeat> =
  getContentRegistry().beatsById;
