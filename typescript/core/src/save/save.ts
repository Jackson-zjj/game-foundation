export interface SaveStorage {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface SaveCodec<T> {
  readonly id: string;
  encode(value: T): string;
  decode(value: string): T;
}

export enum SaveResultCode {
  Success = "success",
  InvalidSlotId = "invalid_slot_id",
  NotFound = "not_found",
  InvalidData = "invalid_data",
  UnsupportedVersion = "unsupported_version",
  CodecMismatch = "codec_mismatch",
  StorageError = "storage_error",
}

export type SaveResult<T> =
  | { readonly code: SaveResultCode.Success; readonly value: T }
  | { readonly code: Exclude<SaveResultCode, SaveResultCode.Success>; readonly error?: unknown };

const SAVE_FORMAT = "game-foundation/save";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class SaveManager<T> {
  private readonly codecId: string;
  private readonly pending = new Map<string, Promise<void>>();

  constructor(
    private readonly storage: SaveStorage,
    private readonly codec: SaveCodec<T>,
    private readonly namespace = "game-foundation",
  ) {
    if (typeof codec.id !== "string" || codec.id.length === 0) {
      throw new TypeError("Save codec ID must be a non-empty string.");
    }
    if (typeof namespace !== "string" || namespace.length === 0) {
      throw new TypeError("Save namespace must be a non-empty string.");
    }
    this.codecId = codec.id;
  }

  save(slotId: string, value: T): Promise<SaveResult<void>> {
    const key = this.keyFor(slotId);
    if (key === null) {
      return Promise.resolve({ code: SaveResultCode.InvalidSlotId });
    }

    // Capture the value at the call site, before any queued storage work begins.
    let serialized: string;
    try {
      const data = this.codec.encode(value);
      if (typeof data !== "string") {
        throw new TypeError("Save codecs must encode values as strings.");
      }
      serialized = JSON.stringify({ format: SAVE_FORMAT, version: 1, codec: this.codecId, data });
    } catch (error) {
      return Promise.resolve({ code: SaveResultCode.InvalidData, error });
    }

    return this.run<void>(key, async () => {
      try {
        await this.storage.write(key, serialized);
        return { code: SaveResultCode.Success, value: undefined };
      } catch (error) {
        return { code: SaveResultCode.StorageError, error };
      }
    });
  }

  load(slotId: string): Promise<SaveResult<T>> {
    const key = this.keyFor(slotId);
    if (key === null) {
      return Promise.resolve({ code: SaveResultCode.InvalidSlotId });
    }

    return this.run<T>(key, async () => {
      let serialized: string | null;
      try {
        serialized = await this.storage.read(key);
      } catch (error) {
        return { code: SaveResultCode.StorageError, error };
      }
      if (serialized === null) {
        return { code: SaveResultCode.NotFound };
      }
      if (typeof serialized !== "string") {
        return { code: SaveResultCode.InvalidData };
      }

      let document: unknown;
      try {
        document = JSON.parse(serialized) as unknown;
      } catch (error) {
        return { code: SaveResultCode.InvalidData, error };
      }
      if (!isRecord(document) || document.format !== SAVE_FORMAT
        || typeof document.version !== "number" || !Number.isSafeInteger(document.version)
        || document.version <= 0) {
        return { code: SaveResultCode.InvalidData };
      }
      if (document.version !== 1) {
        return { code: SaveResultCode.UnsupportedVersion };
      }
      if (typeof document.codec !== "string" || document.codec.length === 0
        || typeof document.data !== "string") {
        return { code: SaveResultCode.InvalidData };
      }
      if (document.codec !== this.codecId) {
        return { code: SaveResultCode.CodecMismatch };
      }
      try {
        return { code: SaveResultCode.Success, value: this.codec.decode(document.data) };
      } catch (error) {
        return { code: SaveResultCode.InvalidData, error };
      }
    });
  }

  remove(slotId: string): Promise<SaveResult<void>> {
    const key = this.keyFor(slotId);
    if (key === null) {
      return Promise.resolve({ code: SaveResultCode.InvalidSlotId });
    }
    return this.run<void>(key, async () => {
      try {
        await this.storage.remove(key);
        return { code: SaveResultCode.Success, value: undefined };
      } catch (error) {
        return { code: SaveResultCode.StorageError, error };
      }
    });
  }

  private keyFor(slotId: string): string | null {
    if (typeof slotId !== "string" || slotId.length === 0) {
      return null;
    }
    return JSON.stringify([this.namespace, this.codecId, slotId]);
  }

  private run<R>(key: string, operation: () => Promise<SaveResult<R>>): Promise<SaveResult<R>> {
    const previous = this.pending.get(key) ?? Promise.resolve();
    const current = previous.then(operation);
    const settled = current.then(() => undefined, () => undefined);
    this.pending.set(key, settled);
    void settled.then(() => {
      if (this.pending.get(key) === settled) {
        this.pending.delete(key);
      }
    });
    return current;
  }
}
