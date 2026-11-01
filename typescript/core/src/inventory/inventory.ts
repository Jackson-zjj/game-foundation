export interface ItemDefinition {
  readonly id: string;
  readonly maxStackSize?: number;
}

export interface ItemStack {
  readonly item: Readonly<Required<ItemDefinition>>;
  readonly quantity: number;
}

export interface InventorySnapshot {
  readonly version: 1;
  readonly slotCapacity: number;
  readonly stacks: readonly ItemStack[];
}

export enum InventoryResult {
  Success = "success",
  InvalidItemId = "invalid_item_id",
  InvalidQuantity = "invalid_quantity",
  InvalidStackLimit = "invalid_stack_limit",
  StackLimitMismatch = "stack_limit_mismatch",
  CapacityExceeded = "capacity_exceeded",
  InsufficientQuantity = "insufficient_quantity",
  QuantityOverflow = "quantity_overflow",
}

interface StoredItemStack {
  readonly item: Readonly<Required<ItemDefinition>>;
  quantity: number;
}

const MAX_SLOT_CAPACITY = 0xffff_ffff;

function isSlotCapacity(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_SLOT_CAPACITY;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class Inventory {
  private readonly slotCapacity: number;
  private stacks: StoredItemStack[] = [];

  constructor(slotCapacity: number) {
    if (!isSlotCapacity(slotCapacity)) {
      throw new RangeError("slotCapacity must be an integer between 0 and 4294967295.");
    }
    this.slotCapacity = slotCapacity;
  }

  static fromSnapshot(snapshot: unknown): Inventory {
    if (!isRecord(snapshot) || snapshot.version !== 1 || !isSlotCapacity(snapshot.slotCapacity)
      || !Array.isArray(snapshot.stacks)) {
      throw new TypeError("Invalid inventory snapshot header.");
    }
    if (snapshot.stacks.length > snapshot.slotCapacity) {
      throw new TypeError("Inventory snapshot exceeds slot capacity.");
    }

    const stacks: StoredItemStack[] = [];
    const totals = new Map<string, { maxStackSize: number; quantity: number }>();
    for (const entry of snapshot.stacks) {
      if (!isRecord(entry) || !isRecord(entry.item)) {
        throw new TypeError("Invalid inventory snapshot stack.");
      }
      const { id, maxStackSize } = entry.item;
      const quantity = entry.quantity;
      if (typeof id !== "string" || id.length === 0 || !isPositiveSafeInteger(maxStackSize)
        || !isPositiveSafeInteger(quantity) || quantity > maxStackSize) {
        throw new TypeError("Invalid inventory snapshot item or quantity.");
      }
      const previous = totals.get(id);
      if (previous && previous.maxStackSize !== maxStackSize) {
        throw new TypeError("Inventory snapshot has conflicting stack limits.");
      }
      const total = previous?.quantity ?? 0;
      if (quantity > Number.MAX_SAFE_INTEGER - total) {
        throw new TypeError("Inventory snapshot item count exceeds the safe-integer limit.");
      }
      totals.set(id, { maxStackSize, quantity: total + quantity });
      stacks.push({ item: { id, maxStackSize }, quantity });
    }

    const inventory = new Inventory(snapshot.slotCapacity);
    inventory.stacks = stacks;
    return inventory;
  }

  addItem(item: ItemDefinition, quantity: number): InventoryResult {
    const itemId = item?.id;
    if (typeof itemId !== "string" || itemId.length === 0) {
      return InventoryResult.InvalidItemId;
    }
    const maxStackSize = item.maxStackSize === undefined ? 1 : item.maxStackSize;
    if (!isPositiveSafeInteger(maxStackSize)) {
      return InventoryResult.InvalidStackLimit;
    }
    if (!isPositiveSafeInteger(quantity)) {
      return InventoryResult.InvalidQuantity;
    }

    let remaining = quantity;
    let currentCount = 0;
    for (const stack of this.stacks) {
      if (stack.item.id !== itemId) {
        continue;
      }
      if (stack.item.maxStackSize !== maxStackSize) {
        return InventoryResult.StackLimitMismatch;
      }
      currentCount += stack.quantity;
      remaining -= Math.min(remaining, maxStackSize - stack.quantity);
    }

    // Check the sum before adding, so all stored item counts remain exact integers.
    if (quantity > Number.MAX_SAFE_INTEGER - currentCount) {
      return InventoryResult.QuantityOverflow;
    }
    const requiredSlots = Math.ceil(remaining / maxStackSize);
    if (requiredSlots > this.slotCapacity - this.stacks.length) {
      return InventoryResult.CapacityExceeded;
    }

    // Prepare new stacks before modifying existing quantities.
    const additions: StoredItemStack[] = [];
    const definition = { id: itemId, maxStackSize };
    while (remaining > 0) {
      const added = Math.min(remaining, maxStackSize);
      additions.push({ item: definition, quantity: added });
      remaining -= added;
    }

    remaining = quantity;
    for (const stack of this.stacks) {
      if (stack.item.id !== itemId || remaining === 0) {
        continue;
      }
      const added = Math.min(remaining, maxStackSize - stack.quantity);
      stack.quantity += added;
      remaining -= added;
    }
    for (const stack of additions) {
      this.stacks.push(stack);
    }
    return InventoryResult.Success;
  }

  removeItem(itemId: string, quantity: number): InventoryResult {
    if (typeof itemId !== "string" || itemId.length === 0) {
      return InventoryResult.InvalidItemId;
    }
    if (!isPositiveSafeInteger(quantity)) {
      return InventoryResult.InvalidQuantity;
    }
    if (this.getItemCount(itemId) < quantity) {
      return InventoryResult.InsufficientQuantity;
    }

    let remaining = quantity;
    for (let index = this.stacks.length - 1; index >= 0 && remaining > 0; --index) {
      const stack = this.stacks[index]!;
      if (stack.item.id !== itemId) {
        continue;
      }
      const removed = Math.min(remaining, stack.quantity);
      stack.quantity -= removed;
      remaining -= removed;
    }
    this.stacks = this.stacks.filter((stack) => stack.quantity > 0);
    return InventoryResult.Success;
  }

  getSlotCapacity(): number {
    return this.slotCapacity;
  }

  getUsedSlotCount(): number {
    return this.stacks.length;
  }

  getItemCount(itemId: string): number {
    let total = 0;
    for (const stack of this.stacks) {
      if (stack.item.id === itemId) {
        total += stack.quantity;
      }
    }
    return total;
  }

  getStacks(): readonly ItemStack[] {
    return this.stacks.map((stack) => ({
      item: { id: stack.item.id, maxStackSize: stack.item.maxStackSize },
      quantity: stack.quantity,
    }));
  }

  toSnapshot(): InventorySnapshot {
    return { version: 1, slotCapacity: this.slotCapacity, stacks: this.getStacks() };
  }
}
