import type { ComponentChildren } from "preact";

import { useEffect, useState } from "preact/hooks";

import styles from "./ShopSpinningMod.module.css";

type RotatingChildrenRenderer = (rotationRad: number) => ComponentChildren;

export default function ShopSpinningMod(props: {
  children: ComponentChildren | RotatingChildrenRenderer;
}) {
  const [rotationRad, setRotationRad] = useState(0);
  useEffect(() => {
    let frameId = 0;
    let lastTime = performance.now();
    const spinRadPerMs = (Math.PI * 2) / 14000;
    const tick = (now: number): void => {
      const dt = now - lastTime;
      lastTime = now;
      setRotationRad((current) => {
        const next = current + dt * spinRadPerMs;
        if (next >= Math.PI * 2) return next % (Math.PI * 2);
        return next;
      });
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  if (typeof props.children === "function") {
    const renderChildren = props.children as RotatingChildrenRenderer;
    return <div className={styles.rotator}>{renderChildren(rotationRad)}</div>;
  }

  return <div className={styles.rotator}>{props.children}</div>;
}
