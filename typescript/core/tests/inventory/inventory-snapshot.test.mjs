import assert from "node:assert/strict";
import test from "node:test";
import { Inventory, InventoryResult } from "@game-foundation/core";

function stack(id, maxStackSize, quantity) {
  return { item: { id, maxStackSize }, quantity };
}

test("inventory snapshots round-trip through JSON into an independent inventory", () => {
  const inventory = new Inventory(3);
  assert.equal(inventory.addItem({ id: "potion", maxStackSize: 10 }, 15), InventoryResult.Success);
  assert.equal(inventory.addItem({ id: "sword" }, 1), InventoryResult.Success);
  const snapshot = inventory.toSnapshot();
  const restored = Inventory.fromSnapshot(JSON.parse(JSON.stringify(snapshot)));
  assert.notEqual(restored, inventory);
  assert.deepEqual(restored.toSnapshot(), snapshot);
  assert.equal(restored.removeItem("potion", 3), InventoryResult.Success);
  assert.equal(restored.getItemCount("potion"), 12);
  assert.equal(inventory.getItemCount("potion"), 15);
});

test("zero-capacity inventories round-trip as empty snapshots", () => {
  const snapshot = new Inventory(0).toSnapshot();
  assert.deepEqual(snapshot, { version: 1, slotCapacity: 0, stacks: [] });
  assert.deepEqual(Inventory.fromSnapshot(snapshot).toSnapshot(), snapshot);
});

test("exported snapshots and restored inventories do not retain external data references", () => {
  const inventory = new Inventory(2);
  assert.equal(inventory.addItem({ id: "potion", maxStackSize: 10 }, 4), InventoryResult.Success);
  const snapshot = inventory.toSnapshot();
  const restored = Inventory.fromSnapshot(snapshot);
  snapshot.stacks[0].quantity = 9;
  snapshot.stacks[0].item.id = "changed";
  snapshot.stacks.push(stack("sword", 1, 1));
  assert.equal(inventory.getItemCount("potion"), 4);
  assert.equal(restored.getItemCount("potion"), 4);
  assert.equal(restored.getUsedSlotCount(), 1);
});

test("invalid snapshot headers and unsupported snapshot versions are rejected", () => {
  const values = [null, undefined, [], {},
    { version: 2, slotCapacity: 0, stacks: [] },
    { version: "1", slotCapacity: 0, stacks: [] },
    { version: 1, slotCapacity: -1, stacks: [] },
    { version: 1, slotCapacity: 0.5, stacks: [] },
    { version: 1, slotCapacity: 4294967296, stacks: [] },
    { version: 1, slotCapacity: 1, stacks: {} },
  ];
  for (const value of values) {
    assert.throws(() => Inventory.fromSnapshot(value), TypeError);
  }
});

test("snapshots cannot contain more stacks than available slots", () => {
  assert.throws(() => Inventory.fromSnapshot({
    version: 1, slotCapacity: 1, stacks: [stack("sword", 1, 1), stack("sword", 1, 1)],
  }), TypeError);
});

test("malformed snapshot stacks are rejected instead of partially restored", () => {
  const invalid = [null, [], {}, { item: null, quantity: 1 },
    stack("", 10, 1), stack(1, 10, 1), stack("potion", 0, 1),
    stack("potion", 0.5, 1), stack("potion", Infinity, 1),
    stack("potion", 10, 0), stack("potion", 10, -1),
    stack("potion", 10, 0.5), stack("potion", 10, 11),
    stack("potion", 10, NaN), { item: { id: "sword" }, quantity: 1 },
  ];
  for (const entry of invalid) {
    assert.throws(() => Inventory.fromSnapshot({
      version: 1, slotCapacity: 2, stacks: [stack("valid", 1, 1), entry],
    }), TypeError);
  }
});

test("snapshot stacks for the same item must agree on their stack limit", () => {
  assert.throws(() => Inventory.fromSnapshot({
    version: 1, slotCapacity: 2, stacks: [stack("potion", 10, 1), stack("potion", 5, 1)],
  }), TypeError);
});

test("snapshot totals cannot exceed the safe-integer range", () => {
  const maximum = Number.MAX_SAFE_INTEGER;
  assert.throws(() => Inventory.fromSnapshot({
    version: 1, slotCapacity: 2,
    stacks: [stack("large", maximum, maximum), stack("large", maximum, 1)],
  }), TypeError);
});

test("valid imported stack order and partial stacks are preserved", () => {
  const snapshot = {
    version: 1, slotCapacity: 3,
    stacks: [stack("potion", 10, 5), stack("sword", 1, 1), stack("potion", 10, 5)],
  };
  const inventory = Inventory.fromSnapshot(snapshot);
  assert.deepEqual(inventory.toSnapshot(), snapshot);
  assert.equal(inventory.removeItem("potion", 5), InventoryResult.Success);
  assert.equal(inventory.addItem({ id: "potion", maxStackSize: 10 }, 5), InventoryResult.Success);
  assert.deepEqual(inventory.getStacks(), [stack("potion", 10, 10), stack("sword", 1, 1)]);
});

test("special item IDs remain ordinary data during snapshot validation", () => {
  const inventory = Inventory.fromSnapshot({
    version: 1, slotCapacity: 1, stacks: [stack("__proto__", 10, 2)],
  });
  assert.equal(inventory.getItemCount("__proto__"), 2);
  assert.equal(inventory.addItem({ id: "__proto__", maxStackSize: 10 }, 1), InventoryResult.Success);
});

test("sparse stack arrays are rejected", () => {
  assert.throws(() => Inventory.fromSnapshot({
    version: 1, slotCapacity: 1, stacks: new Array(1),
  }), TypeError);
});
