import { ShopLabel } from "./ShopLabel";

import styles from "./ShopStats.module.css";

const STEP_COUNT = 12;

export function ShopStats(props: {
  baseDelayMs?: number;
  stats: { label: string; fill: number }[];
  stepCount?: number;
}) {
  return (
    <div className={styles.stats}>
      {props.stats.map((stat, index) => {
        const filledSteps = Math.max(
          1,
          Math.min(
            props.stepCount ?? STEP_COUNT,
            Math.round(stat.fill * (props.stepCount ?? STEP_COUNT)),
          ),
        );
        const statDelay = ((props.baseDelayMs ?? 0) + index * 110) / 1000;
        return (
          <div
            className={styles.stat}
            key={stat.label}
            style={
              {
                "--ship-stat-delay": `${statDelay.toFixed(2)}s`,
              } as Record<string, string>
            }
          >
            <div className={styles.head}>
              <ShopLabel>{stat.label}</ShopLabel>
            </div>
            <span className={styles.rail}>
              {Array.from({ length: filledSteps }, (_, step) => {
                const stepDelay = statDelay + step * 0.04;

                return (
                  <span
                    className={styles.step}
                    key={`${stat.label}-step-${step}`}
                    style={
                      {
                        "--ship-step-delay": `${stepDelay.toFixed(2)}s`,
                      } as Record<string, string>
                    }
                  />
                );
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
