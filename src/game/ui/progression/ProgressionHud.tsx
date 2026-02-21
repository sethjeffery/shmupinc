import clsx from "clsx";

import styles from "./ProgressionHud.module.css";

interface ProgressionHudProps {
  currentNodeName: null | string;
  description?: string;
  isComplete: boolean;
  isLaunching: boolean;
  menuDisabled: boolean;
  onMenu: () => void;
  titleText: string;
}

export function ProgressionHud(props: ProgressionHudProps) {
  return (
    <div className={clsx(props.isLaunching && styles.launching)}>
      <div className={styles.hud}>
        <div className={styles.title}>
          <span className={styles.titleText}>
            {props.titleText || "\u00a0"}
          </span>
          <span aria-hidden="true" className={styles.titleCursor}>
            _
          </span>
        </div>
        <button
          className={styles.menu}
          disabled={props.menuDisabled}
          onClick={props.onMenu}
          type="button"
        >
          Main Menu
        </button>
      </div>
      <div className={styles.hudCaption}>{props.description ?? ""}</div>
      <div className={styles.current}>
        {props.isComplete
          ? "Galaxy Complete"
          : props.currentNodeName
            ? `Current: ${props.currentNodeName}`
            : "Campaign ready"}
      </div>
    </div>
  );
}
