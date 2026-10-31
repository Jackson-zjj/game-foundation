import { Inventory, InventoryResult } from "@game-foundation/core";
import type { ItemDefinition, ItemStack } from "@game-foundation/core";

const item: ItemDefinition = { id: "potion", maxStackSize: 10 };
const inventory = new Inventory(2);
const result: InventoryResult = inventory.addItem(item, 15);
if (result !== InventoryResult.Success) {
  throw new Error(result);
}

const stacks: readonly ItemStack[] = inventory.getStacks();

// @ts-expect-error Stack snapshots expose a readonly array.
stacks.push({ item: { id: "sword", maxStackSize: 1 }, quantity: 1 });
// @ts-expect-error Stack quantities cannot be assigned through the public type.
stacks[0]!.quantity = 1;
// @ts-expect-error Nested item definitions are also readonly.
stacks[0]!.item.id = "changed";
// @ts-expect-error Item definition IDs are readonly.
item.id = "changed";
// @ts-expect-error Quantities must be numbers.
inventory.addItem(item, "1");
