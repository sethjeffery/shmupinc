import { clsx } from "clsx";

const MENU_EXIT_MS = 520;
const MENU_ENTRY_MS = 820;

import { AudioControls } from "../../audio/AudioControls";
import { useEnterLeave } from "../shop/hooks/useEnterLeave";
import { MenuBackgroundCanvas } from "./MenuBackgroundCanvas";

import styles from "./MenuOverlay.module.css";

export const MenuOverlay = (props: {
  musicEnabled: boolean;
  onAction: (action: string, levelId?: string) => void;
  soundEnabled: boolean;
}) => {
  const { onAction } = props;
  const { entered, entering, leave, leaving } = useEnterLeave({
    entryDuration: MENU_ENTRY_MS,
    exitDuration: MENU_EXIT_MS,
  });

  const startCampaign = () => {
    void leave().then(() => onAction("start"));
  };

  return (
    <div
      className={clsx(
        styles.menuStage,
        leaving ? styles.isLeaving : undefined,
        entering ? styles.isEntering : undefined,
        entered ? styles.isEntered : undefined,
      )}
    >
      <MenuBackgroundCanvas leaving={leaving} entering={entering} />
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
