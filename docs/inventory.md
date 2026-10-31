# 基础背包

## 范围

背包模块提供物品添加、移除、堆叠、容量限制和数量查询。实现仅使用标准 C++，不依赖 UE 对象、界面或资源。

当前版本不包含存档、物品效果、装备、重量限制、拖拽排序或稳定的格子编号。这些能力根据后续需求扩展。

## 使用示例

将使用方链接到 `GameFoundation::Core` 后，可以直接使用公共头文件：

```cpp
#include <gamefoundation/inventory.hpp>

int main() {
    using gamefoundation::Inventory;
    using gamefoundation::InventoryResult;
    using gamefoundation::ItemDefinition;

    Inventory inventory(2);
    const ItemDefinition potion{"potion", 10};

    if (inventory.AddItem(potion, 15) != InventoryResult::Success) {
        return 1;
    }
    if (inventory.RemoveItem("potion", 3) != InventoryResult::Success) {
        return 1;
    }

    return inventory.GetItemCount("potion") == 12 ? 0 : 1;
}
```

独立构建和 CMake 接入方式见[独立核心构建](building.md)。

## 数据与规则

- 背包容量以格数计算。构造参数为 `std::uint32_t`，容量为 `0` 的背包合法，但无法添加物品。
- `ItemDefinition::id` 是非空字符串，区分大小写；物品配置由使用方管理。
- `ItemDefinition::max_stack_size` 是每格堆叠上限，必须大于 `0`，默认值为 `1`。
- 单次添加或移除的数量使用 `std::int32_t`，必须大于 `0`。
- 同一物品 ID 仍存在于背包时，添加操作必须使用相同的堆叠上限，否则返回错误。全部移除后，旧定义不会保留。
- 添加时先填充已有堆叠，再使用新格子；不同物品 ID 不共享堆叠。
- 移除时从最后一叠该物品开始消耗，移除空堆叠，尽量释放格子。
- 业务校验失败时，整个请求被拒绝，背包数据保持原状，不进行部分添加或部分移除。
- `GetItemCount` 使用 `std::int64_t` 返回总数量，避免多个大堆叠的数量相加产生 32 位溢出。

## 接口

| 接口 | 作用 |
| --- | --- |
| `Inventory(slot_capacity)` | 创建指定格数的空背包 |
| `AddItem(item, quantity)` | 根据物品定义添加数量，返回操作结果 |
| `RemoveItem(item_id, quantity)` | 根据物品 ID 移除数量，返回操作结果 |
| `GetSlotCapacity()` | 查询格数上限 |
| `GetUsedSlotCount()` | 查询当前使用的格数 |
| `GetItemCount(item_id)` | 查询该物品总数量，不存在时返回 `0` |
| `GetStacks()` | 获取只读堆叠列表 |

`GetStacks()` 返回的引用、元素引用和索引不应跨修改操作长期保存。新增格子可能触发重新分配，移除空堆叠会使后续元素前移；修改后应重新查询。

## 操作结果

添加和移除使用 `InventoryResult` 返回业务结果，调用方需要检查返回值。

| 结果 | 含义 |
| --- | --- |
| `Success` | 请求全部完成 |
| `InvalidItemId` | 物品 ID 为空 |
| `InvalidQuantity` | 数量为零或负数 |
| `InvalidStackLimit` | 添加时指定的堆叠上限为零或负数 |
| `StackLimitMismatch` | 添加时，同 ID 已有物品的堆叠上限与传入定义不同 |
| `CapacityExceeded` | 无法容纳本次添加的全部数量 |
| `InsufficientQuantity` | 本次移除的数量超过持有数量，包括该 ID 不存在的情况 |

这些结果描述业务校验。标准库内存分配等系统异常仍按标准 C++ 行为向调用方传播。
