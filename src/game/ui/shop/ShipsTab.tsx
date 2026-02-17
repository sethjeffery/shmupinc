import ShopTabFrame from "./ShopTabFrame";

export const ShipsTab = (props: { cards: preact.ComponentChildren }) => {
  return (
    <ShopTabFrame
      bodyClassName="shop-catalog"
      description="Select your hull and tune base handling stats before launch."
      title="Ships"
    >
      {props.cards}
    </ShopTabFrame>
  );
};

export default ShipsTab;
