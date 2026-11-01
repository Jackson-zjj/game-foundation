# TypeScript 存档基础

## 当前范围

提供版本化存档协议、槽位管理、编解码器接口、异步存储接口、内存实现，以及背包快照的保存与恢复。共同协议见[存档规则](../../specs/save.md)。

**`MemorySaveStorage` 只保存当前进程内的数据，不能在重启后恢复。** 实际文件、微信存储或云端服务需要实现 `SaveStorage`。当前没有引入 Cocos、微信或 Node 文件 API，也未提供自动版本迁移、槽位目录、加密或云同步。

## 使用示例

以下函数可在不安装游戏引擎的环境中运行。内存后端用于演示和测试：

```typescript
import {
  Inventory, InventoryResult, MemorySaveStorage,
  SaveManager, SaveResultCode, inventorySaveCodec,
} from "@game-foundation/core";

export async function saveAndRestore(): Promise<Inventory> {
  const storage = new MemorySaveStorage();
  const saves = new SaveManager(storage, inventorySaveCodec);
  const inventory = new Inventory(2);
  if (inventory.addItem({ id: "potion", maxStackSize: 10 }, 15) !== InventoryResult.Success) {
    throw new Error("添加物品失败");
  }

  const saved = await saves.save("slot-1", inventory);
  if (saved.code !== SaveResultCode.Success) {
    throw new Error(`保存失败：${saved.code}`);
  }
  const loaded = await saves.load("slot-1");
  if (loaded.code !== SaveResultCode.Success) {
    throw new Error(`读取失败：${loaded.code}`);
  }
  return loaded.value;
}
```

`loaded.value` 是经过校验的新背包，与保存前的实例和输入快照互不共享可变数据。

## 接口

| 接口 | 作用 |
| --- | --- |
| `new SaveManager(storage, codec, namespace?)` | 创建某种数据的存档管理器，默认命名空间为 `game-foundation` |
| `save(slotId, value)` | 捕获数据并保存，返回 `Promise<SaveResult<void>>` |
| `load(slotId)` | 读取并解码，返回 `Promise<SaveResult<T>>` |
| `remove(slotId)` | 删除槽位，返回 `Promise<SaveResult<void>>` |

槽位 ID 必须为非空字符串。命名空间与编解码器 ID 也必须为非空字符串，构造时不合法会抛出 `TypeError`。

同一管理器内，同槽位操作按调用顺序执行，不同槽位可以并行。保存的数据在 `save()` 调用时完成编码，不会等写入排队结束后再读取业务对象。跨管理器与跨进程协调由后端负责。

## 存储后端

```typescript
export interface SaveStorage {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
```

- `read`：键不存在时返回 `null`，存在时返回原始字符串。
- `write`：正常完成表示后端接受了本次写入；具体持久性与失败保护由后端定义。
- `remove`：删除不存在的键也应正常完成。
- 后端可抛出或拒绝异常，管理器会转为 `StorageError`。

`MemorySaveStorage` 使用 Map 实现此接口。多个管理器传入同一个内存后端对象可以共享数据，重新创建后端则得到空数据。

## 编解码器

```typescript
export interface SaveCodec<T> {
  readonly id: string;
  encode(value: T): string;
  decode(value: string): T;
}
```

编解码器负责数据格式与业务版本，方法为同步操作。非法输入可抛出异常，由管理器转为 `InvalidData`。`inventorySaveCodec` 使用 JSON 和背包快照版本 `1`，解码时调用 `Inventory.fromSnapshot()` 完整校验后再返回实例。

`SaveManager` 不依赖背包实现，也可以搭配其他业务数据的编解码器使用。编解码器 ID 应保持稳定；修改 ID 会改变对应的存储键。

## 操作结果

返回值是带 `code` 的联合类型，只有成功结果包含 `value`。失败结果可以包含 `error: unknown`，由调用方决定如何处理。

| `SaveResultCode` | 含义 |
| --- | --- |
| `Success` | 操作完成；读取结果包含恢复后的业务值 |
| `InvalidSlotId` | 槽位 ID 为空或不是字符串 |
| `NotFound` | 读取的槽位不存在 |
| `InvalidData` | 编码失败、存档格式错误或业务数据校验失败 |
| `UnsupportedVersion` | 外层协议版本有效但当前不支持 |
| `CodecMismatch` | 存档记录的编解码器 ID 与当前管理器不符 |
| `StorageError` | 后端读取、写入或删除发生异常 |

背包快照版本不支持时由背包解码器拒绝，读取结果为 `InvalidData`；它与外层协议的 `UnsupportedVersion` 不同。

## 包入口与验证

- `@game-foundation/core`：全部核心公开接口。
- `@game-foundation/core/save`：存档管理器、结果类型、接口和内存后端。
- `@game-foundation/core/inventory/save`：背包编解码器。

在仓库根目录运行 `npm --prefix typescript/core test`，会检查公开类型并运行背包与存档测试，不需要游戏工程。
