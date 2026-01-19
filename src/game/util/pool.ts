export interface Poolable {
  active: boolean;
  deactivate: () => void;
}

export class ObjectPool<T extends Poolable> {
  private items: T[] = [];
  private factory: () => T;

  constructor(factory: () => T, initialSize = 0) {
    this.factory = factory;
    for (let i = 0; i < initialSize; i += 1) {
      this.items.push(this.factory());
    }
  }

  acquire(): T {
    const item = this.items.find((i) => !i.active);
    if (item) {
      return item;
    }
    const created = this.factory();
    this.items.push(created);
    return created;
  }

  forEachActive(fn: (item: T) => void): void {
    for (const item of this.items) {
      if (item.active) fn(item);
    }
  }
}
