import type { LevelConversationMoment } from "./levels/types";

export type UiTutorialRoute =
  | "gameover"
  | "hangar"
  | "menu"
  | "pause"
  | "play"
  | "progression"
  | "startup";

export type UiTutorialShopEvent = "open";

export interface UiRouteTutorialCondition {
  maxTimes?: number;
}

export interface UiRouteTutorialTrigger {
  id: string;
  moments: LevelConversationMoment[];
  route?: UiTutorialRoute;
  when?: UiRouteTutorialCondition;
}
