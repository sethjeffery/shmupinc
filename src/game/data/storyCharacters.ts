import type { StoryCharacter } from "./storyCharacterTypes";

import { getContentRegistry } from "../../content/registry";

export const STORY_CHARACTERS: Record<string, StoryCharacter> =
  getContentRegistry().charactersById;

export const getCharacterAvatar = (
  characterId: string,
  expression?: string,
): null | string => {
  const character = STORY_CHARACTERS[characterId];
  if (!character) return null;

  if (expression) {
    const matchingExpression = character.avatars.find(
      (avatar) => avatar.expression === expression,
    );
    if (matchingExpression) {
      return matchingExpression.image;
    }
  }

  if (character.defaultExpression) {
    const defaultAvatar = character.avatars.find(
      (avatar) => avatar.expression === character.defaultExpression,
    );
    if (defaultAvatar) {
      return defaultAvatar.image;
    }
  }

  return character.avatars[0]?.image ?? null;
};
