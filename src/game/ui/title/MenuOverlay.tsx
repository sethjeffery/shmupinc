import { signal } from "@preact/signals";
import { clsx } from "clsx";
import { useCallback, useEffect, useState } from "preact/hooks";

const enterTimer = signal<null | number>(null);
const exitTimer = signal<null | number>(null);

const MENU_EXIT_MS = 820;
const MENU_ENTRY_MS = 820;

import { AudioControls } from "../../audio/AudioControls";
import { MenuBackgroundCanvas } from "./MenuBackgroundCanvas";

import styles from "./MenuOverlay.module.css";

export const MenuOverlay = (props: {
  musicEnabled: boolean;
  onAction: (action: string, levelId?: string) => void;
  soundEnabled: boolean;
}) => {
  const [entering, setEntering] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [entered, setEntered] = useState(false);
  const { onAction } = props;

  const startCampaign = useCallback((): void => {
    if (leaving) return;
    setLeaving(true);
    if (exitTimer.value !== null) {
      window.clearTimeout(exitTimer.value);
    }
    exitTimer.value = window.setTimeout(() => {
      onAction("start");
    }, MENU_EXIT_MS);
  }, [leaving, onAction]);

  useEffect(() => {
    enterTimer.value = window.setTimeout(() => {
      setEntered(true);
      setEntering(false);
    }, MENU_ENTRY_MS);
    return () => {
      if (exitTimer.value !== null) {
        window.clearTimeout(exitTimer.value);
      }
      if (enterTimer.value !== null) {
        window.clearTimeout(enterTimer.value);
      }
    };
  }, []);

  return (
    <div
      className={clsx(
        styles.menuStage,
        leaving ? styles.isLeaving : undefined,
        entering ? styles.isEntering : undefined,
        entered ? styles.isEntered : undefined,
      )}
    >
      <MenuBackgroundCanvas leaving={leaving} />
      <div className={styles.menuCenter}>
        <div className={styles.menuTitleBlock}>
          <div className={styles.menuBadge}>Vector Combat Campaign</div>
          <h1 className={styles.menuTitle}>Shmup Inc.</h1>
        </div>
        <button
          className={clsx(styles.menuStartButton)}
          disabled={leaving}
          onClick={startCampaign}
          type="button"
        >
          Start Campaign
        </button>
      </div>
      <AudioControls
        musicEnabled={props.musicEnabled}
        onToggleMusic={() => props.onAction("toggle-music")}
        onToggleSound={() => props.onAction("toggle-sound")}
        soundEnabled={props.soundEnabled}
      />
    </div>
  );
};
