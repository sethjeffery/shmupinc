import clsx from "clsx";

import styles from "./AudioControls.module.css";

interface AudioControlsProps {
  musicEnabled: boolean;
  soundEnabled: boolean;
  onToggleMusic: () => void;
  onToggleSound: () => void;
}

export const AudioControls = ({
  musicEnabled,
  onToggleMusic,
  onToggleSound,
  soundEnabled,
}: AudioControlsProps) => {
  return (
    <div className={styles.menuAudio}>
      <button
        className={clsx(
          styles.menuAudioToggle,
          musicEnabled ? styles.isOn : undefined,
        )}
        onClick={onToggleMusic}
        type="button"
      >
        Music {musicEnabled ? "On" : "Off"}
      </button>
      <button
        className={clsx(
          styles.menuAudioToggle,
          soundEnabled ? styles.isOn : undefined,
        )}
        onClick={onToggleSound}
        type="button"
      >
        Sound {soundEnabled ? "On" : "Off"}
      </button>
    </div>
  );
};
