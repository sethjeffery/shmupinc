import type { ComponentChildren } from "preact";

import { clsx } from "clsx";

import styles from "../../scenes/ShopScene.module.css";

export function NodeLink(props: {
  active?: boolean;
  from: { x: number; y: number };
  id?: string;
  selected?: boolean;
  surge?: boolean;
  to: { x: number; y: number };
}) {
  const { active, from, id, selected, surge, to } = props;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const width = Math.hypot(dx, dy);
  const className = clsx(
    styles["shop-node-link"],
    active ? styles["is-active"] : undefined,
    selected ? styles["is-selected"] : undefined,
    surge ? styles["is-surge"] : undefined,
  );
  return (
    <div
      className={className}
      key={id}
      style={{
        left: `${from.x}px`,
        top: `${from.y}px`,
        transform: `rotate(${Math.atan2(dy, dx)}rad)`,
        width: `${width}px`,
      }}
    />
  );
}

function NodeGraphContainer(props: {
  worldStyle: { height: number; width: number };
  onMountVisualRef: (el: HTMLDivElement | null) => void;
  onViewportRef: (el: HTMLDivElement | null) => void;
  onWorldRef: (el: HTMLDivElement | null) => void;
  onWheel?: (e: WheelEvent) => void;
  onPointerCancel?: (e: PointerEvent) => void;
  onPointerDown?: (e: PointerEvent) => void;
  onPointerMove?: (e: PointerEvent) => void;
  onPointerUp?: (e: PointerEvent) => void;
  children?: ComponentChildren;
}) {
  return (
    <div
      className={styles["shop-node-graph"]}
      ref={props.onMountVisualRef}
      onWheel={(e) => props.onWheel?.(e as WheelEvent)}
    >
      <div
        className={styles["shop-node-viewport"]}
        ref={props.onViewportRef}
        onPointerCancel={(e) => props.onPointerCancel?.(e as PointerEvent)}
        onPointerDown={(e) => props.onPointerDown?.(e as PointerEvent)}
        onPointerMove={(e) => props.onPointerMove?.(e as PointerEvent)}
        onPointerUp={(e) => props.onPointerUp?.(e as PointerEvent)}
      >
        <div
          className={styles["shop-node-world"]}
          ref={props.onWorldRef}
          style={{
            height: `${props.worldStyle.height}px`,
            width: `${props.worldStyle.width}px`,
          }}
        >
          {props.children}
        </div>
      </div>
    </div>
  );
}

export default NodeGraphContainer;
