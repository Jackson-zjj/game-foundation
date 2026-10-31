# C++ 基础背包

## 范围

背包模块提供物品添加、移除、堆叠、容量限制和数量查询。实现仅使用标准 C++，不依赖 UE 对象、界面或资源。

头文件与实现位于 `cpp/core/inventory/`，测试位于 `cpp/tests/inventory/`。跨语言共同遵循的行为见[背包规则](../../specs/inventory.md)。

当前版本不包含存档、物品效果、装备、重量限制、拖拽排序或稳定的格子编号。这些能力根据后续需求扩展。

## 使用示例

将使用方链接到 `GameFoundation::Inventory` 或 `GameFoundation::Core` 后，可以直接使用公共头文件：

```cpp
#include <inventory/inventory.hpp>

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

## C++ 数据表示

- 构造参数为 `std::uint32_t`，表示格数上限。
- `ItemDefinition::id` 使用 `std::string` 保存；查询和移除接口使用 `std::string_view` 接收 ID。
- `ItemDefinition::max_stack_size` 使用 `std::int32_t`，默认值为 `1`。
- 单次添加或移除的数量使用 `std::int32_t`，必须大于 `0`。
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
