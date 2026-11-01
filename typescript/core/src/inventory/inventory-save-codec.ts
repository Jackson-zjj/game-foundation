import { Inventory } from "./inventory.js";
import type { SaveCodec } from "../save/save.js";

export const inventorySaveCodec: SaveCodec<Inventory> = Object.freeze({
  id: "inventory",
  encode(value: Inventory): string {
    return JSON.stringify(value.toSnapshot());
  },
  decode(value: string): Inventory {
    return Inventory.fromSnapshot(JSON.parse(value) as unknown);
  },
});
