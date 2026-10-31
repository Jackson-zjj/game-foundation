#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace gamefoundation {

struct ItemDefinition {
    std::string id;
    std::int32_t max_stack_size = 1;
};

struct ItemStack {
    ItemDefinition item;
    std::int32_t quantity = 0;
};

enum class InventoryResult {
    Success,
    InvalidItemId,
    InvalidQuantity,
    InvalidStackLimit,
    StackLimitMismatch,
    CapacityExceeded,
    InsufficientQuantity,
};

class Inventory {
public:
    explicit Inventory(std::uint32_t slot_capacity) noexcept;

    // Rejected operations leave the inventory unchanged.
    [[nodiscard]] InventoryResult AddItem(ItemDefinition item, std::int32_t quantity);
    [[nodiscard]] InventoryResult RemoveItem(std::string_view item_id, std::int32_t quantity);

    [[nodiscard]] std::uint32_t GetSlotCapacity() const noexcept;
    [[nodiscard]] std::size_t GetUsedSlotCount() const noexcept;
    [[nodiscard]] std::int64_t GetItemCount(std::string_view item_id) const noexcept;

    // Slots are compacted after removal; mutations can invalidate references and indices.
    [[nodiscard]] const std::vector<ItemStack>& GetStacks() const noexcept;

private:
    std::uint32_t slot_capacity_;
    std::vector<ItemStack> stacks_;
};

} // namespace gamefoundation
