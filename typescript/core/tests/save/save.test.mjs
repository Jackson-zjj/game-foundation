import assert from "node:assert/strict";
import test from "node:test";
import {
  Inventory, InventoryResult, MemorySaveStorage, SaveManager, SaveResultCode, inventorySaveCodec,
} from "@game-foundation/core";

function inventoryWith(quantity) {
  const inventory = new Inventory(3);
  assert.equal(inventory.addItem({ id: "potion", maxStackSize: 10 }, quantity), InventoryResult.Success);
  return inventory;
}

function storageKey(slotId = "slot-1", codec = "inventory", namespace = "game-foundation") {
  return JSON.stringify([namespace, codec, slotId]);
}

function envelope(overrides = {}) {
  return JSON.stringify({
    format: "game-foundation/save", version: 1, codec: "inventory",
    data: inventorySaveCodec.encode(inventoryWith(2)), ...overrides,
  });
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

const textCodec = {
  id: "text",
  encode(value) {
    if (typeof value !== "string") throw new TypeError("Expected text");
    return value;
  },
  decode(value) { return value; },
};

test("missing save slots return NotFound", async () => {
  const manager = new SaveManager(new MemorySaveStorage(), inventorySaveCodec);
  assert.equal((await manager.load("slot-1")).code, SaveResultCode.NotFound);
});

test("inventories save and load as independent instances", async () => {
  const manager = new SaveManager(new MemorySaveStorage(), inventorySaveCodec);
  const inventory = inventoryWith(15);
  assert.equal((await manager.save("slot-1", inventory)).code, SaveResultCode.Success);
  const loaded = await manager.load("slot-1");
  assert.equal(loaded.code, SaveResultCode.Success);
  assert.notEqual(loaded.value, inventory);
  assert.deepEqual(loaded.value.toSnapshot(), inventory.toSnapshot());
  assert.equal(loaded.value.removeItem("potion", 1), InventoryResult.Success);
  assert.equal(inventory.getItemCount("potion"), 15);
});

test("saving captures the current state before asynchronous work starts", async () => {
  const manager = new SaveManager(new MemorySaveStorage(), inventorySaveCodec);
  const inventory = inventoryWith(2);
  const saving = manager.save("slot-1", inventory);
  assert.equal(inventory.addItem({ id: "potion", maxStackSize: 10 }, 1), InventoryResult.Success);
  assert.equal((await saving).code, SaveResultCode.Success);
  const loaded = await manager.load("slot-1");
  assert.equal(loaded.code, SaveResultCode.Success);
  assert.equal(loaded.value.getItemCount("potion"), 2);
});

test("overwriting one slot leaves other slots unchanged", async () => {
  const manager = new SaveManager(new MemorySaveStorage(), inventorySaveCodec);
  await manager.save("slot-1", inventoryWith(1));
  await manager.save("slot-2", inventoryWith(2));
  await manager.save("slot-1", inventoryWith(3));
  const first = await manager.load("slot-1");
  const second = await manager.load("slot-2");
  assert.equal(first.code, SaveResultCode.Success);
  assert.equal(second.code, SaveResultCode.Success);
  assert.equal(first.value.getItemCount("potion"), 3);
  assert.equal(second.value.getItemCount("potion"), 2);
});

test("new managers can read the same backend but fresh memory backends are empty", async () => {
  const storage = new MemorySaveStorage();
  await new SaveManager(storage, inventorySaveCodec).save("slot-1", inventoryWith(2));
  const loaded = await new SaveManager(storage, inventorySaveCodec).load("slot-1");
  assert.equal(loaded.code, SaveResultCode.Success);
  assert.equal(loaded.value.getItemCount("potion"), 2);
  const fresh = new SaveManager(new MemorySaveStorage(), inventorySaveCodec);
  assert.equal((await fresh.load("slot-1")).code, SaveResultCode.NotFound);
});

test("slot removal is idempotent and does not remove other slots", async () => {
  const manager = new SaveManager(new MemorySaveStorage(), inventorySaveCodec);
  await manager.save("slot-1", inventoryWith(1));
  await manager.save("slot-2", inventoryWith(2));
  assert.equal((await manager.remove("slot-1")).code, SaveResultCode.Success);
  assert.equal((await manager.remove("slot-1")).code, SaveResultCode.Success);
  assert.equal((await manager.load("slot-1")).code, SaveResultCode.NotFound);
  assert.equal((await manager.load("slot-2")).code, SaveResultCode.Success);
});

test("invalid slot IDs do not invoke storage or codecs", async () => {
  let calls = 0;
  const unexpected = async () => { ++calls; throw new Error("Unexpected access"); };
  const manager = new SaveManager({ read: unexpected, write: unexpected, remove: unexpected }, {
    id: "test", encode() { ++calls; throw new Error("Unexpected encode"); }, decode() {},
  });
  for (const slotId of ["", null, undefined, 1]) {
    assert.equal((await manager.save(slotId, null)).code, SaveResultCode.InvalidSlotId);
    assert.equal((await manager.load(slotId)).code, SaveResultCode.InvalidSlotId);
    assert.equal((await manager.remove(slotId)).code, SaveResultCode.InvalidSlotId);
  }
  assert.equal(calls, 0);
});

test("namespaces and codec IDs have collision-free storage keys", async () => {
  const storage = new MemorySaveStorage();
  const first = new SaveManager(storage, { ...textCodec, id: "c" }, "a:b");
  const second = new SaveManager(storage, { ...textCodec, id: "b:c" }, "a");
  await first.save("slot", "first");
  await second.save("slot", "second");
  assert.equal((await first.load("slot")).value, "first");
  assert.equal((await second.load("slot")).value, "second");
});

test("slot IDs preserve Unicode and unpaired surrogate strings", async () => {
  const manager = new SaveManager(new MemorySaveStorage(), textCodec);
  for (const slotId of ["\u5b58\u6863", "a:b", "\ud800", " "]) {
    assert.equal((await manager.save(slotId, slotId)).code, SaveResultCode.Success);
    assert.equal((await manager.load(slotId)).value, slotId);
  }
});

test("invalid codec IDs and namespaces are constructor errors", () => {
  for (const id of ["", null, 1]) {
    assert.throws(() => new SaveManager(new MemorySaveStorage(), { ...textCodec, id }), TypeError);
  }
  for (const namespace of ["", null, 1]) {
    assert.throws(() => new SaveManager(new MemorySaveStorage(), textCodec, namespace), TypeError);
  }
});

test("storage errors are reported for reads, writes and removals", async () => {
  const error = new Error("Storage unavailable");
  const unavailable = async () => { throw error; };
  const manager = new SaveManager({ read: unavailable, write: unavailable, remove: unavailable }, textCodec);
  const results = [await manager.save("slot", "text"), await manager.load("slot"), await manager.remove("slot")];
  for (const result of results) {
    assert.equal(result.code, SaveResultCode.StorageError);
    assert.equal(result.error, error);
  }
});

test("failed encoding preserves an existing save", async () => {
  const storage = new MemorySaveStorage();
  const working = new SaveManager(storage, inventorySaveCodec);
  await working.save("slot-1", inventoryWith(2));
  const failing = new SaveManager(storage, {
    ...inventorySaveCodec, encode() { throw new Error("Invalid input"); },
  });
  assert.equal((await failing.save("slot-1", null)).code, SaveResultCode.InvalidData);
  assert.equal((await working.load("slot-1")).value.getItemCount("potion"), 2);
});

test("codecs returning non-string data are rejected before writing", async () => {
  const storage = new MemorySaveStorage();
  const manager = new SaveManager(storage, { ...textCodec, encode() { return 1; } });
  assert.equal((await manager.save("slot", "value")).code, SaveResultCode.InvalidData);
  assert.equal(await storage.read(storageKey("slot", "text")), null);
});

test("malformed save envelopes are rejected", async () => {
  const storage = new MemorySaveStorage();
  const manager = new SaveManager(storage, inventorySaveCodec);
  const invalid = ["not json", "null", "[]", "{}", envelope({ format: "other" }),
    envelope({ version: 0 }), envelope({ version: 1.5 }), envelope({ codec: "" }),
    envelope({ data: {} }), envelope({ version: "1" }),
  ];
  for (const raw of invalid) {
    await storage.write(storageKey(), raw);
    assert.equal((await manager.load("slot-1")).code, SaveResultCode.InvalidData);
  }
});

test("unknown save format versions are rejected explicitly", async () => {
  const storage = new MemorySaveStorage();
  await storage.write(storageKey(), envelope({ version: 2 }));
  const manager = new SaveManager(storage, inventorySaveCodec);
  assert.equal((await manager.load("slot-1")).code, SaveResultCode.UnsupportedVersion);
});

test("future versions are identified before interpreting their payload schema", async () => {
  const storage = new MemorySaveStorage();
  await storage.write(storageKey(), JSON.stringify({
    format: "game-foundation/save", version: 2, payload: { future: true },
  }));
  const manager = new SaveManager(storage, inventorySaveCodec);
  assert.equal((await manager.load("slot-1")).code, SaveResultCode.UnsupportedVersion);
});

test("mismatched codec identifiers are rejected", async () => {
  const storage = new MemorySaveStorage();
  await storage.write(storageKey(), envelope({ codec: "other" }));
  const manager = new SaveManager(storage, inventorySaveCodec);
  assert.equal((await manager.load("slot-1")).code, SaveResultCode.CodecMismatch);
});

test("invalid inventory payloads fail without modifying live inventories", async () => {
  const storage = new MemorySaveStorage();
  const manager = new SaveManager(storage, inventorySaveCodec);
  const inventory = inventoryWith(2);
  for (const data of ["not json", "null", JSON.stringify({ version: 2, slotCapacity: 0, stacks: [] })]) {
    await storage.write(storageKey(), envelope({ data }));
    assert.equal((await manager.load("slot-1")).code, SaveResultCode.InvalidData);
    assert.equal(inventory.getItemCount("potion"), 2);
  }
});

test("invalid backend return types are rejected", async () => {
  const manager = new SaveManager({ async read() { return undefined; } }, inventorySaveCodec);
  assert.equal((await manager.load("slot-1")).code, SaveResultCode.InvalidData);
});

test("same-slot writes and subsequent reads follow call order", { timeout: 2000 }, async () => {
  const storage = new MemorySaveStorage();
  const gate = deferred();
  const started = deferred();
  const writes = [];
  const manager = new SaveManager({
    read: (key) => storage.read(key),
    remove: (key) => storage.remove(key),
    async write(key, value) {
      writes.push(JSON.parse(JSON.parse(value).data).stacks[0].quantity);
      if (writes.length === 1) {
        started.resolve();
        await gate.promise;
      }
      await storage.write(key, value);
    },
  }, inventorySaveCodec);
  const first = manager.save("slot-1", inventoryWith(1));
  await started.promise;
  try {
    const second = manager.save("slot-1", inventoryWith(2));
    const loading = manager.load("slot-1");
    await Promise.resolve();
    assert.deepEqual(writes, [1]);
    gate.resolve();
    assert.equal((await first).code, SaveResultCode.Success);
    assert.equal((await second).code, SaveResultCode.Success);
    assert.equal((await loading).value.getItemCount("potion"), 2);
    assert.deepEqual(writes, [1, 2]);
  } finally {
    gate.resolve();
  }
});

test("slow writes do not block different slots", { timeout: 2000 }, async () => {
  const storage = new MemorySaveStorage();
  const gate = deferred();
  const started = deferred();
  const manager = new SaveManager({
    read: (key) => storage.read(key),
    remove: (key) => storage.remove(key),
    async write(key, value) {
      if (JSON.parse(key)[2] === "slow") {
        started.resolve();
        await gate.promise;
      }
      await storage.write(key, value);
    },
  }, textCodec);
  const slow = manager.save("slow", "first");
  await started.promise;
  try {
    assert.equal((await manager.save("fast", "second")).code, SaveResultCode.Success);
  } finally {
    gate.resolve();
  }
  assert.equal((await slow).code, SaveResultCode.Success);
});

test("failed queued writes do not block subsequent operations", async () => {
  const storage = new MemorySaveStorage();
  let first = true;
  const manager = new SaveManager({
    read: (key) => storage.read(key),
    remove: (key) => storage.remove(key),
    async write(key, value) {
      if (first) { first = false; throw new Error("First write failed"); }
      await storage.write(key, value);
    },
  }, textCodec);
  const failing = manager.save("slot", "first");
  const succeeding = manager.save("slot", "second");
  assert.equal((await failing).code, SaveResultCode.StorageError);
  assert.equal((await succeeding).code, SaveResultCode.Success);
  assert.equal((await manager.load("slot")).value, "second");
});

test("removal waits for earlier writes in the same slot", async () => {
  const manager = new SaveManager(new MemorySaveStorage(), textCodec);
  const saving = manager.save("slot", "value");
  const removing = manager.remove("slot");
  const loading = manager.load("slot");
  assert.equal((await saving).code, SaveResultCode.Success);
  assert.equal((await removing).code, SaveResultCode.Success);
  assert.equal((await loading).code, SaveResultCode.NotFound);
});

test("save envelopes expose the documented protocol and codec payload", async () => {
  const storage = new MemorySaveStorage();
  const manager = new SaveManager(storage, inventorySaveCodec);
  const inventory = inventoryWith(2);
  await manager.save("slot-1", inventory);
  const document = JSON.parse(await storage.read(storageKey()));
  assert.equal(document.format, "game-foundation/save");
  assert.equal(document.version, 1);
  assert.equal(document.codec, "inventory");
  assert.deepEqual(JSON.parse(document.data), inventory.toSnapshot());
});

test("custom codecs can store values unrelated to inventories", async () => {
  const manager = new SaveManager(new MemorySaveStorage(), textCodec);
  assert.equal((await manager.save("slot", "hello")).code, SaveResultCode.Success);
  assert.deepEqual(await manager.load("slot"), { code: SaveResultCode.Success, value: "hello" });
});

test("save subpaths export the same API as the package root", async () => {
  const saveModule = await import("@game-foundation/core/save");
  const inventoryModule = await import("@game-foundation/core/inventory/save");
  assert.equal(saveModule.SaveManager, SaveManager);
  assert.equal(saveModule.MemorySaveStorage, MemorySaveStorage);
  assert.equal(inventoryModule.inventorySaveCodec, inventorySaveCodec);
});
