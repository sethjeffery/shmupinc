import type { DialogMomentTransition } from "./dialogMoment";
import type { DialogMomentView } from "./dialogMomentState";

import clsx from "clsx";
import { useEffect, useMemo } from "preact/hooks";

import {
  STORY_CHARACTERS,
  getCharacterAvatar,
} from "../game/data/storyCharacters";
import { useEnterLeave } from "../game/ui/shop/hooks/useEnterLeave";
import { useTypewriter } from "../game/ui/shop/hooks/useTypewriter";

import styles from "./DialogMomentOverlay.module.css";

interface TransitionConfig {
  entryDurationMs: number;
  exitDurationMs: number;
  typewriterSpeed: number;
}

const TRANSITION_CONFIG_BY_KIND: Record<
  DialogMomentTransition,
  TransitionConfig
> = {
  smooth: {
    entryDurationMs: 220,
    exitDurationMs: 220,
    typewriterSpeed: 16,
  },
  urgent: {
    entryDurationMs: 120,
    exitDurationMs: 120,
    typewriterSpeed: 9,
  },
  wham: {
    entryDurationMs: 0,
    exitDurationMs: 90,
    typewriterSpeed: 0,
  },
};

const DialogMomentText = (props: {
  momentKey: string;
  speed: number;
  text: string;
}) => {
  const typedText = useTypewriter(props.text, Math.max(1, props.speed), {
    restartKey: props.momentKey,
  });
  const visibleText = props.speed <= 0 ? props.text : typedText;
  return <div className={styles.dialogMomentText}>{visibleText}</div>;
};

const getEnteringClass = (
  entering: boolean,
  transition: DialogMomentTransition,
): string | undefined => {
  if (!entering || transition === "wham") return undefined;
  return transition === "urgent"
    ? styles.enteringUrgent
    : styles.enteringSmooth;
};

const getLeavingClass = (
  leaving: boolean,
  transition: DialogMomentTransition,
): string | undefined => {
  if (!leaving) return undefined;
  if (transition === "wham") return styles.leavingWham;
  return transition === "urgent" ? styles.leavingUrgent : styles.leavingSmooth;
};

export const DialogMomentOverlay = (props: {
  moment: DialogMomentView;
  onComplete: (momentKey: string) => void;
  shouldTransitionOut: (momentKey: string) => boolean;
}) => {
  const { moment, onComplete, shouldTransitionOut } = props;
  const {
    characterId,
    durationMs,
    expression,
    key,
    placement,
    text,
    transition,
  } = moment;
  const transitionConfig = TRANSITION_CONFIG_BY_KIND[transition];
  const { entering, leave, leaving } = useEnterLeave({
    entryDuration: transitionConfig.entryDurationMs,
    exitDuration: transitionConfig.exitDurationMs,
  });

  const avatarImage = useMemo(
    () => characterId && getCharacterAvatar(characterId, expression),
    [characterId, expression],
  );
  const characterName = characterId
    ? (STORY_CHARACTERS[characterId]?.name ?? null)
    : null;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (shouldTransitionOut(key)) {
        void leave().then(() => onComplete(key));
      } else {
        onComplete(key);
      }
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, key, leave, onComplete, shouldTransitionOut]);

  return (
    <div
      className={clsx(
        styles.dialogMoment,
        getEnteringClass(entering, transition),
        getLeavingClass(leaving, transition),
        placement === "bottom"
          ? styles.dialogMomentBottom
          : styles.dialogMomentTop,
      )}
    >
      {avatarImage ? (
        <div className={styles.dialogMomentAvatarFrame}>
          <img
            alt={characterName ? `${characterName} avatar` : "Character avatar"}
            className={styles.dialogMomentAvatar}
            src={avatarImage}
          />
        </div>
      ) : null}
      <div
        className={clsx(
          styles.dialogMomentCard,
          transition === "wham" &&
            (Number(key) % 2 === 0
              ? styles.dialogMomentCardWhamA
              : styles.dialogMomentCardWhamB),
          avatarImage ? undefined : styles.dialogMomentNoAvatar,
        )}
      >
        <div className={styles.dialogMomentName}>{characterName}</div>
        <DialogMomentText
          key={key}
          momentKey={key}
          speed={transitionConfig.typewriterSpeed}
          text={text}
        />
      </div>
    </div>
  );
};
