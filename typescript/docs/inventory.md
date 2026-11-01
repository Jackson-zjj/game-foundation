# TypeScript 基础背包

## 范围

实现位于 `typescript/core/src/inventory/inventory.ts`，共同规则见[背包规则](../../specs/inventory.md)。提供添加、移除、堆叠、容量限制、查询和版本化快照。保存与读取由[存档模块](save.md)处理，背包本身不访问文件、平台存储或引擎。

## 用法

使用方接入已构建的核心包后，可以从根入口导入：

```typescript
import { Inventory, InventoryResult } from "@game-foundation/core";

const inventory = new Inventory(2);
const potion = { id: "potion", maxStackSize: 10 };

const added = inventory.addItem(potion, 15);
if (added !== InventoryResult.Success) {
  throw new Error(`添加失败：${added}`);
}

const removed = inventory.removeItem("potion", 3);
if (removed !== InventoryResult.Success) {
  throw new Error(`移除失败：${removed}`);
}

if (inventory.getItemCount("potion") !== 12) {
  throw new Error("物品数量不符合预期");
}
```

也可以从 `@game-foundation/core/inventory` 导入相同接口。安装、构建与测试见[构建说明](building.md)。

## 数据表示

- `ItemDefinition` 包含只读的 `id: string` 和可选的 `maxStackSize: number`。省略堆叠上限时默认为 `1`。
- 容量、数量和堆叠上限使用 `number`，要求整数，拒绝小数、非有限数和不安全整数。
- 构造容量范围为 `0` 到 `4294967295`，不合法时抛出 `RangeError`；创建背包不会按容量预先分配全部格子。
- 单次数量与堆叠上限范围为 `1` 到 `Number.MAX_SAFE_INTEGER`。
- 同一物品总数量最多为 `Number.MAX_SAFE_INTEGER`。添加后将超过此值时，返回 `QuantityOverflow`，数据保持不变。

输入物品定义会复制为内部数据。`getStacks()` 返回具有只读类型声明的快照，包含新的数组、堆叠对象和物品定义对象。修改快照不会改变背包，背包后续变化也不会更新旧快照。

## 接口

| 接口 | 作用 |
| --- | --- |
| `new Inventory(slotCapacity)` | 创建指定格数的空背包 |
| `addItem(item, quantity)` | 添加全部数量，返回业务结果 |
| `removeItem(itemId, quantity)` | 移除全部数量，返回业务结果 |
| `getSlotCapacity()` | 查询格数上限 |
| `getUsedSlotCount()` | 查询已用格数 |
| `getItemCount(itemId)` | 查询该物品总数量，不存在时返回 `0` |
| `getStacks()` | 获取堆叠的只读快照 |
| `toSnapshot()` | 导出带版本、容量和堆叠数据的独立快照 |
| `Inventory.fromSnapshot(value)` | 校验未知数据并恢复为新背包，非法快照抛出 `TypeError` |

## 快照与恢复

`toSnapshot()` 返回 `InventorySnapshot`，格式为 `{ version: 1, slotCapacity, stacks }`。可以通过标准 JSON 序列化保存，再交给 `Inventory.fromSnapshot()` 校验和恢复。

恢复时检查版本、容量、每格数量、同 ID 的堆叠上限和总数量范围。恢复保留合法的堆叠顺序与数量，包括多个未满堆叠，不会自动合并它们。恢复结果不保留输入对象引用，也不修改已有实例。

该快照格式当前只在 TypeScript 实现；C++ 尚未提供相应导入导出。跨语言的格式参考见[存档规则](../../specs/save.md)。

## 操作结果

`InventoryResult` 使用字符串枚举，调用方应检查添加和移除的返回值：

| 结果 | 含义 |
| --- | --- |
| `Success` | 请求全部完成 |
| `InvalidItemId` | 物品 ID 为空或运行时输入不是字符串 |
| `InvalidQuantity` | 数量不是正的安全整数 |
| `InvalidStackLimit` | 堆叠上限不是正的安全整数 |
| `StackLimitMismatch` | 同 ID 的已有堆叠上限与传入定义不同 |
| `CapacityExceeded` | 格子不足，无法完成全部添加 |
| `InsufficientQuantity` | 移除数量超过持有数量 |
| `QuantityOverflow` | 添加后物品总数量将超过安全整数上限 |

这些结果描述业务校验，业务失败不会部分修改数据。运行环境的内存分配等系统错误不作为业务结果返回。

## 与 C++ 版本的差异

共同规则和常规操作保持一致，接口使用 TypeScript 的驼峰命名。数值范围与查询结果的生命周期按语言分别定义：

| 项目 | C++ | TypeScript |
| --- | --- | --- |
| 容量 | `std::uint32_t` | 同范围的整数 `number` |
| 单次数量、堆叠上限 | 正的 `std::int32_t` | 正的安全整数 `number` |
| 物品总数量 | `std::int64_t` | 不超过 `Number.MAX_SAFE_INTEGER` |
| 堆叠查询 | 只读引用，修改后可能失效 | 独立只读快照 |

跨语言共享数据时，需要约定双方都支持的范围。TypeScript 的 `number` 无法精确表示 C++ 的全部 64 位整数。
