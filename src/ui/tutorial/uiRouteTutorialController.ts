import type { UiRouteTutorialCondition } from "../../game/data/uiTutorialTypes";
import type { DialogMomentRequest } from "../dialogMoment";
import type { UiRoute } from "../router";

import {
  getUiTutorialTriggerCount,
  incrementUiTutorialTriggerCount,
} from "../../game/data/save";
import { getUiRouteTutorials } from "../../game/data/uiTutorials";

const passesCondition = (
  condition: UiRouteTutorialCondition | undefined,
  count: number,
): boolean => {
  if (!condition) return true;
  if (condition.maxTimes !== undefined && count >= condition.maxTimes) {
    return false;
  }
  return true;
};

export class UiRouteTutorialController {
  private readonly showDialogMoment: (
    moments: DialogMomentRequest[],
    options?: { isTutorial?: boolean; onSequenceComplete?: () => void },
  ) => void;

  constructor(
    showDialogMoment: (
      moments: DialogMomentRequest[],
      options?: { isTutorial?: boolean; onSequenceComplete?: () => void },
    ) => void,
  ) {
    this.showDialogMoment = showDialogMoment;
  }

  private triggerIfEligible(
    trigger: {
      id: string;
      moments: DialogMomentRequest[];
      when?: UiRouteTutorialCondition;
    },
    options?: { onSequenceComplete?: () => void },
  ): boolean {
    const count = getUiTutorialTriggerCount(trigger.id);
    if (!passesCondition(trigger.when, count)) return false;
    incrementUiTutorialTriggerCount(trigger.id);
    this.showDialogMoment(trigger.moments, {
      isTutorial: true,
      onSequenceComplete: options?.onSequenceComplete,
    });
    return true;
  }

  handleRoute(
    route: UiRoute,
    options?: { onSequenceComplete?: () => void },
  ): boolean {
    for (const trigger of getUiRouteTutorials()) {
      if (trigger.route !== route) continue;
      if (this.triggerIfEligible(trigger, options)) return true;
    }
    return false;
  }
}
