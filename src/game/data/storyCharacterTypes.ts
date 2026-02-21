export interface StoryCharacterAvatar {
  expression: string;
  image: string;
}

export interface StoryCharacter {
  avatars: StoryCharacterAvatar[];
  defaultExpression?: string;
  id: string;
  name: string;
}
