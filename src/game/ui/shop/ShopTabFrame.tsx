import type { ComponentChildren } from "preact";

export default function ShopTabFrame(props: {
  bodyClassName?: string;
  children: ComponentChildren;
  description: string;
  title: string;
}) {
  const bodyClass = props.bodyClassName
    ? `shop-content-body ${props.bodyClassName}`
    : "shop-content-body";

  return (
    <section className="shop-content">
      <header className="shop-content-header">
        <h3 className="shop-content-title">{props.title}</h3>
        <p className="shop-content-description">{props.description}</p>
      </header>
      <div className={bodyClass}>{props.children}</div>
    </section>
  );
}
