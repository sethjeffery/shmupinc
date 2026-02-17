import styles from "../scenes/ShopScene.module.css";

export default function ShopCard(props: {
  id: string;
  state: string;
  type: string;
  key?: string;
  onClick?: () => void;
  style?: Record<string, string>;
  renderIcon: () => preact.ComponentChildren;
  name: string;
  description: string;
  status: string;
}) {
  return (
    <button
      className={styles["shop-card"]}
      data-id={props.id}
      data-state={props.state}
      data-type={props.type}
      key={props.key}
      onClick={props.onClick}
      style={props.style}
      type="button"
    >
      <div className={styles["shop-card-inner"]}>
        <div className={styles["card-icon"]}>{props.renderIcon()}</div>
        <div className={styles["card-title"]}>{props.name}</div>
        <div className={styles["card-desc"]}>{props.description}</div>
        <div className={styles["card-status"]}>{props.status}</div>
      </div>
    </button>
  );
}
