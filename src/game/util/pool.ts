export interface Poolable {
  active: boolean;
  deactivate: () => void;
}

export class ObjectPool<T extends Poolable> {
  private items: T[] = [];
  private freeIndices: number[] = [];
  private factory: () => T;

  constructor(factory: () => T, initialSize = 0) {
    this.factory = factory;
    for (let i = 0; i < initialSize; i += 1) {
      this.createItem(true);
    }
  }

  acquire(): T {
    while (this.freeIndices.length > 0) {
      const index = this.freeIndices.pop();
      if (typeof index !== "number") break;
      const item = this.items[index];
      if (item && !item.active) return item;
    }
    return this.createItem(false);
  }

  forEachActive(fn: (item: T) => void): void {
    for (const item of this.items) {
      if (item.active) fn(item);
    }
  }

  private createItem(addToFreeList: boolean): T {
    const item = this.factory();
    const index = this.items.length;
    const originalDeactivate = item.deactivate.bind(item);
    item.deactivate = () => {
      if (!item.active) {
        originalDeactivate();
        return;
      }
      originalDeactivate();
      this.freeIndices.push(index);
    };
    this.items.push(item);
    if (addToFreeList && !item.active) {
      this.freeIndices.push(index);
    }
    return item;
  }
}
