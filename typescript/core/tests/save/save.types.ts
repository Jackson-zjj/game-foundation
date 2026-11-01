import { Inventory, MemorySaveStorage, SaveManager, SaveResultCode, inventorySaveCodec } from "@game-foundation/core";
import type { SaveCodec, SaveResult, SaveStorage } from "@game-foundation/core";

async function checkSaveTypes(): Promise<void> {
  const storage: SaveStorage = new MemorySaveStorage();
  const codec: SaveCodec<Inventory> = inventorySaveCodec;
  const manager = new SaveManager(storage, codec);
  const loaded: SaveResult<Inventory> = await manager.load("slot");
  if (loaded.code === SaveResultCode.Success) {
    const inventory: Inventory = loaded.value;
    inventory.getItemCount("potion");
  } else {
    // @ts-expect-error Failed loads do not expose a value.
    loaded.value;
  }
  // @ts-expect-error This manager saves inventories, not strings.
  manager.save("slot", "value");
  // @ts-expect-error Slot IDs must be strings.
  manager.load(1);
  // @ts-expect-error Storage writes must accept serialized strings.
  storage.write("key", 1);
}

void checkSaveTypes;
