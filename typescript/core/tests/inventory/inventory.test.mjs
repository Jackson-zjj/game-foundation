import assert from "node:assert/strict";
import test from "node:test";
import { Inventory, InventoryResult } from "@game-foundation/core";

const potion = Object.freeze({ id: "potion", maxStackSize: 10 });
const sword = Object.freeze({ id: "sword", maxStackSize: 1 });

function add(inventory, item, quantity) {
  assert.equal(inventory.addItem(item, quantity), InventoryResult.Success);
}

function stack(id, maxStackSize, quantity) {
  return { item: { id, maxStackSize }, quantity };
}

test("new inventories are empty", () => {
  const inventory = new Inventory(3);
  assert.equal(inventory.getSlotCapacity(), 3);
  assert.equal(inventory.getUsedSlotCount(), 0);
  assert.equal(inventory.getItemCount("potion"), 0);
  assert.deepEqual(inventory.getStacks(), []);
});

test("adding an item updates its quantity", () => {
  const inventory = new Inventory(2);
  add(inventory, potion, 4);
  assert.equal(inventory.getItemCount("potion"), 4);
  assert.deepEqual(inventory.getStacks(), [stack("potion", 10, 4)]);
});

test("existing stacks are filled before new slots are used", () => {
  const inventory = new Inventory(3);
  add(inventory, potion, 8);
  add(inventory, potion, 7);
  assert.deepEqual(inventory.getStacks(), [stack("potion", 10, 10), stack("potion", 10, 5)]);
});

test("different item IDs do not share a stack", () => {
  const inventory = new Inventory(3);
  add(inventory, potion, 3);
  add(inventory, { id: "ether", maxStackSize: 10 }, 4);
  assert.equal(inventory.getUsedSlotCount(), 2);
  assert.equal(inventory.getItemCount("potion"), 3);
  assert.equal(inventory.getItemCount("ether"), 4);
});

test("non-stackable items each occupy a slot", () => {
  const inventory = new Inventory(2);
  add(inventory, sword, 2);
  assert.deepEqual(inventory.getStacks(), [stack("sword", 1, 1), stack("sword", 1, 1)]);
  assert.equal(inventory.addItem(sword, 1), InventoryResult.CapacityExceeded);
});

test("a partial stack can be filled when every slot is occupied", () => {
  const inventory = new Inventory(1);
  add(inventory, potion, 4);
  add(inventory, potion, 6);
  assert.deepEqual(inventory.getStacks(), [stack("potion", 10, 10)]);
});

test("capacity failures leave every existing stack unchanged", () => {
  const inventory = new Inventory(2);
  add(inventory, potion, 8);
  add(inventory, sword, 1);
  const before = inventory.getStacks();
  assert.equal(inventory.addItem(potion, 3), InventoryResult.CapacityExceeded);
  assert.deepEqual(inventory.getStacks(), before);
});

test("zero-capacity inventories reject additions", () => {
  const inventory = new Inventory(0);
  assert.equal(inventory.addItem(potion, 1), InventoryResult.CapacityExceeded);
  assert.deepEqual(inventory.getStacks(), []);
});

test("removal consumes the last stacks first and removes empty slots", () => {
  const inventory = new Inventory(3);
  add(inventory, potion, 25);
  assert.equal(inventory.removeItem("potion", 12), InventoryResult.Success);
  assert.equal(inventory.getItemCount("potion"), 13);
  assert.deepEqual(inventory.getStacks(), [stack("potion", 10, 10), stack("potion", 10, 3)]);
});

test("removing all items frees slots for other items", () => {
  const inventory = new Inventory(2);
  add(inventory, potion, 20);
  assert.equal(inventory.removeItem("potion", 20), InventoryResult.Success);
  assert.deepEqual(inventory.getStacks(), []);
  add(inventory, sword, 2);
  assert.equal(inventory.getUsedSlotCount(), 2);
});

test("insufficient-quantity failures leave stacks unchanged", () => {
  const inventory = new Inventory(2);
  add(inventory, potion, 15);
  const before = inventory.getStacks();
  assert.equal(inventory.removeItem("potion", 16), InventoryResult.InsufficientQuantity);
  assert.deepEqual(inventory.getStacks(), before);
});

test("removing a missing item does not affect other items", () => {
  const inventory = new Inventory(1);
  add(inventory, potion, 2);
  assert.equal(inventory.removeItem("sword", 1), InventoryResult.InsufficientQuantity);
  assert.deepEqual(inventory.getStacks(), [stack("potion", 10, 2)]);
});

test("zero and negative quantities are rejected", () => {
  const inventory = new Inventory(2);
  add(inventory, potion, 2);
  for (const quantity of [0, -1, -2147483648]) {
    assert.equal(inventory.addItem(potion, quantity), InventoryResult.InvalidQuantity);
    assert.equal(inventory.removeItem("potion", quantity), InventoryResult.InvalidQuantity);
  }
  assert.deepEqual(inventory.getStacks(), [stack("potion", 10, 2)]);
});

test("empty IDs and non-positive stack limits are rejected", () => {
  const inventory = new Inventory(2);
  assert.equal(inventory.addItem({ id: "", maxStackSize: 10 }, 1), InventoryResult.InvalidItemId);
  assert.equal(inventory.removeItem("", 1), InventoryResult.InvalidItemId);
  for (const maxStackSize of [0, -1]) {
    assert.equal(inventory.addItem({ id: "potion", maxStackSize }, 1), InventoryResult.InvalidStackLimit);
  }
  assert.deepEqual(inventory.getStacks(), []);
});

test("a stored item ID must keep its existing stack limit", () => {
  const inventory = new Inventory(3);
  add(inventory, potion, 2);
  assert.equal(inventory.addItem({ id: "potion", maxStackSize: 5 }, 1), InventoryResult.StackLimitMismatch);
  assert.deepEqual(inventory.getStacks(), [stack("potion", 10, 2)]);
});

test("fully removed item IDs can be added with a new definition", () => {
  const inventory = new Inventory(1);
  add(inventory, potion, 2);
  assert.equal(inventory.removeItem("potion", 2), InventoryResult.Success);
  add(inventory, { id: "potion", maxStackSize: 5 }, 5);
  assert.deepEqual(inventory.getStacks(), [stack("potion", 5, 5)]);
});

test("totals larger than signed 32-bit integers remain exact", () => {
  const maximum = 2147483647;
  const inventory = new Inventory(2);
  const item = { id: "large", maxStackSize: maximum };
  add(inventory, item, maximum);
  add(inventory, item, maximum);
  assert.equal(inventory.getItemCount("large"), 2 * maximum);
  assert.equal(inventory.addItem(item, 1), InventoryResult.CapacityExceeded);
  assert.equal(inventory.removeItem("large", maximum), InventoryResult.Success);
  assert.equal(inventory.getItemCount("large"), maximum);
});

test("a queried definition can be used to add more items", () => {
  const inventory = new Inventory(2);
  add(inventory, potion, 5);
  add(inventory, inventory.getStacks()[0].item, 10);
  assert.deepEqual(inventory.getStacks(), [stack("potion", 10, 10), stack("potion", 10, 5)]);
});

test("a queried ID can be used to remove an item", () => {
  const inventory = new Inventory(2);
  add(inventory, potion, 2);
  add(inventory, sword, 1);
  const id = inventory.getStacks()[0].item.id;
  assert.equal(inventory.removeItem(id, 2), InventoryResult.Success);
  assert.deepEqual(inventory.getStacks(), [stack("sword", 1, 1)]);
});

test("500 consecutive operations match an independent aggregate model", () => {
  const items = [potion, sword, { id: "gem", maxStackSize: 4 }];
  const inventory = new Inventory(7);
  const counts = new Map(items.map((item) => [item.id, 0]));

  for (let step = 0; step < 500; ++step) {
    const item = items[(step * 7 + 1) % items.length];
    const quantity = (step * 5) % 12 + 1;
    if (step % 5 < 3) {
      const requiredSlots = items.reduce((total, candidate) => {
        const nextCount = counts.get(candidate.id) + (candidate.id === item.id ? quantity : 0);
        return total + Math.ceil(nextCount / candidate.maxStackSize);
      }, 0);
      const expected = requiredSlots <= inventory.getSlotCapacity()
        ? InventoryResult.Success : InventoryResult.CapacityExceeded;
      assert.equal(inventory.addItem(item, quantity), expected, `add at step ${step}`);
      if (expected === InventoryResult.Success) {
        counts.set(item.id, counts.get(item.id) + quantity);
      }
    } else {
      const expected = counts.get(item.id) >= quantity
        ? InventoryResult.Success : InventoryResult.InsufficientQuantity;
      assert.equal(inventory.removeItem(item.id, quantity), expected, `remove at step ${step}`);
      if (expected === InventoryResult.Success) {
        counts.set(item.id, counts.get(item.id) - quantity);
      }
    }

    const expectedSlots = items.reduce((total, candidate) =>
      total + Math.ceil(counts.get(candidate.id) / candidate.maxStackSize), 0);
    assert.equal(inventory.getUsedSlotCount(), expectedSlots);
    assert.ok(inventory.getUsedSlotCount() <= inventory.getSlotCapacity());
    for (const candidate of items) {
      assert.equal(inventory.getItemCount(candidate.id), counts.get(candidate.id));
    }
    for (const current of inventory.getStacks()) {
      assert.ok(current.quantity > 0 && current.quantity <= current.item.maxStackSize);
    }
  }
});

test("omitting the stack limit defaults it to one", () => {
  const inventory = new Inventory(2);
  add(inventory, { id: "sword" }, 2);
  assert.deepEqual(inventory.getStacks(), [stack("sword", 1, 1), stack("sword", 1, 1)]);
});

test("invalid constructor capacities throw RangeError", () => {
  for (const capacity of [-1, 0.5, NaN, Infinity, 4294967296, undefined, null, "2"]) {
    assert.throws(() => new Inventory(capacity), RangeError);
  }
});

test("large capacities do not eagerly allocate slots", () => {
  const inventory = new Inventory(4294967295);
  assert.equal(inventory.getSlotCapacity(), 4294967295);
  assert.equal(inventory.getUsedSlotCount(), 0);
  assert.equal(inventory.addItem(sword, Number.MAX_SAFE_INTEGER), InventoryResult.CapacityExceeded);
  assert.deepEqual(inventory.getStacks(), []);
});

test("fractional, non-finite and unsafe quantities are rejected", () => {
  const inventory = new Inventory(2);
  add(inventory, potion, 2);
  for (const quantity of [0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, "1", undefined]) {
    assert.equal(inventory.addItem(potion, quantity), InventoryResult.InvalidQuantity);
    assert.equal(inventory.removeItem("potion", quantity), InventoryResult.InvalidQuantity);
  }
  assert.deepEqual(inventory.getStacks(), [stack("potion", 10, 2)]);
});

test("runtime inputs must have valid IDs and safe integer stack limits", () => {
  const inventory = new Inventory(2);
  for (const item of [null, undefined, {}, { id: 1 }]) {
    assert.equal(inventory.addItem(item, 1), InventoryResult.InvalidItemId);
  }
  for (const id of [null, undefined, 1]) {
    assert.equal(inventory.removeItem(id, 1), InventoryResult.InvalidItemId);
  }
  for (const maxStackSize of [0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "10", null]) {
    assert.equal(inventory.addItem({ id: "potion", maxStackSize }, 1), InventoryResult.InvalidStackLimit);
  }
  assert.deepEqual(inventory.getStacks(), []);
});

test("stack allocation is correct near the safe-integer limit", () => {
  const item = { id: "large", maxStackSize: Number.MAX_SAFE_INTEGER - 1 };
  const insufficient = new Inventory(1);
  assert.equal(insufficient.addItem(item, Number.MAX_SAFE_INTEGER), InventoryResult.CapacityExceeded);
  assert.deepEqual(insufficient.getStacks(), []);

  const inventory = new Inventory(2);
  add(inventory, item, Number.MAX_SAFE_INTEGER);
  assert.deepEqual(inventory.getStacks(), [
    stack("large", item.maxStackSize, item.maxStackSize),
    stack("large", item.maxStackSize, 1),
  ]);
  assert.equal(inventory.getItemCount("large"), Number.MAX_SAFE_INTEGER);
});

test("count overflow is rejected without losing integer precision", () => {
  const inventory = new Inventory(2);
  const item = { id: "large", maxStackSize: Number.MAX_SAFE_INTEGER };
  add(inventory, item, Number.MAX_SAFE_INTEGER);
  const before = inventory.getStacks();
  assert.equal(inventory.addItem(item, 1), InventoryResult.QuantityOverflow);
  assert.deepEqual(inventory.getStacks(), before);
  assert.equal(inventory.removeItem("large", 1), InventoryResult.Success);
  add(inventory, item, 1);
  assert.equal(inventory.getItemCount("large"), Number.MAX_SAFE_INTEGER);
});

test("input objects and returned snapshots cannot mutate stored data", () => {
  const inventory = new Inventory(2);
  const definition = { ...potion };
  add(inventory, definition, 4);
  definition.id = "changed";
  definition.maxStackSize = 1;

  const snapshot = inventory.getStacks();
  snapshot[0].quantity = 999;
  snapshot[0].item.id = "changed";
  snapshot[0].item.maxStackSize = 1;
  snapshot.push(stack("sword", 1, 1));
  assert.deepEqual(inventory.getStacks(), [stack("potion", 10, 4)]);

  const before = inventory.getStacks();
  add(inventory, potion, 1);
  assert.deepEqual(before, [stack("potion", 10, 4)]);
  assert.equal(inventory.getItemCount("potion"), 5);
});

test("package root and inventory subpath export the same API", async () => {
  const inventoryModule = await import("@game-foundation/core/inventory");
  assert.equal(inventoryModule.Inventory, Inventory);
  assert.equal(inventoryModule.InventoryResult, InventoryResult);
});
