import ShopTabFrame from "./ShopTabFrame";

export const ArmoryTab = (props: { cards: preact.ComponentChildren }) => {
  return (
    <ShopTabFrame
      bodyClassName="shop-catalog"
      description="Buy and compare weapons, then pair them with support mods."
      title="Armory"
    >
      {props.cards}
    </ShopTabFrame>
  );
};

export default ArmoryTab;
