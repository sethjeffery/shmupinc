import { clsx } from "clsx";
import { useEffect, useRef } from "preact/hooks";

import { createMenuBackgroundGame } from "../../menuBackground/createMenuBackgroundGame";

import styles from "./MenuBackgroundCanvas.module.css";

export const MenuBackgroundCanvas = ({ leaving }: { leaving?: boolean }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<null | Phaser.Game>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const game = createMenuBackgroundGame(host);
    gameRef.current = game;

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className={clsx(
        styles.menuBackgroundLayer,
        leaving ? styles.leaving : undefined,
      )}
    >
      <div className={styles.menuBackgroundCanvas} ref={hostRef} />
      <div className={styles.menuBackgroundTint} />
    </div>
  );
};
