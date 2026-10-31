export interface ItemDefinition {
  readonly id: string;
  readonly maxStackSize?: number;
}

export interface ItemStack {
  readonly item: Readonly<Required<ItemDefinition>>;
  readonly quantity: number;
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

export class Inventory {
  private readonly slotCapacity: number;
  private stacks: StoredItemStack[] = [];

  constructor(slotCapacity: number) {
    if (!Number.isInteger(slotCapacity) || slotCapacity < 0 || slotCapacity > MAX_SLOT_CAPACITY) {
      throw new RangeError("slotCapacity must be an integer between 0 and 4294967295.");
    }
    this.slotCapacity = slotCapacity;
  }

  addItem(item: ItemDefinition, quantity: number): InventoryResult {
    const itemId = item?.id;
    if (typeof itemId !== "string" || itemId.length === 0) {
      return InventoryResult.InvalidItemId;
    }
    const maxStackSize = item.maxStackSize === undefined ? 1 : item.maxStackSize;
    if (!Number.isSafeInteger(maxStackSize) || maxStackSize <= 0) {
      return InventoryResult.InvalidStackLimit;
    }
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
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
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
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
}
