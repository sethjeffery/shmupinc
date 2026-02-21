import type { StoryCharacter } from "./storyCharacterTypes";

import { getContentRegistry } from "../../content/registry";

export const STORY_CHARACTERS: Record<string, StoryCharacter> =
  getContentRegistry().charactersById;

const resolveCharacterExpression = (
  characterId: string,
  expression?: string,
): string | undefined => {
  const character = STORY_CHARACTERS[characterId];
  if (!character) return undefined;

  if (expression) {
    const matchingExpression = character.avatars.find(
      (avatar) => avatar.expression === expression,
    );
    if (matchingExpression) {
      return matchingExpression.expression;
    }
  }

  if (character.defaultExpression) {
    const defaultAvatar = character.avatars.find(
      (avatar) => avatar.expression === character.defaultExpression,
    );
    if (defaultAvatar) {
      return defaultAvatar.expression;
    }
  }

  return character.avatars[0]?.expression;
};

export const getCharacterAvatar = (
  characterId: string,
  expression?: string,
): null | string => {
  const character = STORY_CHARACTERS[characterId];
  if (!character) return null;

  const resolvedExpression = resolveCharacterExpression(
    characterId,
    expression,
  );
  if (!resolvedExpression) return character.avatars[0]?.image ?? null;
  return (
    character.avatars.find((avatar) => avatar.expression === resolvedExpression)
      ?.image ??
    character.avatars[0]?.image ??
    null
  );
};
