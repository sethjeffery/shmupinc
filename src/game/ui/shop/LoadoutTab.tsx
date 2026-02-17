import ShopTabFrame from "./ShopTabFrame";

export const LoadoutTab = (props: { content: preact.ComponentChildren }) => {
  return (
    <ShopTabFrame
      bodyClassName="shop-content-body--loadout"
      description="Route weapons and mods to mount nodes for your next run."
      title="Loadout"
    >
      {props.content}
    </ShopTabFrame>
  );
};

export default LoadoutTab;
