import styles from "./ShopEffects.module.css";

export function ShopEffects(props: { effects: string[]; title?: string }) {
  if (props.effects.length === 0) return null;

  return (
    <div className={styles.effects}>
      <div className={styles.title}>{props.title ?? "Effects"}</div>
      <div className={styles.list}>
        {props.effects.length > 0 ? (
          props.effects.map((effect) => (
            <span className={styles.effect} key={effect}>
              {effect}
            </span>
          ))
        ) : (
          <span className={styles.muted}>None</span>
        )}
      </div>
    </div>
  );
}
