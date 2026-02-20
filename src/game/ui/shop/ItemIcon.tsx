import type { VectorShape } from "../../data/vectorShape";

import ShopNodeIcon from "../ShopNodeIcon";
import { drawShopIcon, type CardIconKind } from "./iconPainter";

import styles from "./ItemIcon.module.css";

const formatColor = (color: number): string =>
  `#${color.toString(16).padStart(6, "0")}`;

export function ItemIcon(props: {
  accentColor: number;
  shape: VectorShape;
  className?: string;
  size?: number;
  kind: CardIconKind;
}) {
  const size = Math.max(24, Math.round(props.size ?? 100));
  return (
    <ShopNodeIcon
      className={props.className ?? styles["shop-node-icon"]}
      size={size}
      onDraw={(canvas) =>
        drawShopIcon({
          canvas,
          colorHex: formatColor(props.accentColor),
          colorValue: props.accentColor,
          kind: props.kind,
          shape: props.shape,
        })
      }
    />
  );
}
