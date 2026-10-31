#include <gamefoundation/inventory.hpp>

#include <algorithm>
#include <utility>

namespace gamefoundation {

Inventory::Inventory(std::uint32_t slot_capacity) noexcept
    : slot_capacity_(slot_capacity) {
}

InventoryResult Inventory::AddItem(ItemDefinition item, std::int32_t quantity) {
    if (item.id.empty()) {
        return InventoryResult::InvalidItemId;
    }
    if (item.max_stack_size <= 0) {
        return InventoryResult::InvalidStackLimit;
    }
    if (quantity <= 0) {
        return InventoryResult::InvalidQuantity;
    }

    // Preflight the complete request before filling any existing stacks.
    std::int64_t remaining = quantity;
    for (const auto& stack : stacks_) {
        if (stack.item.id != item.id) {
            continue;
        }
        if (stack.item.max_stack_size != item.max_stack_size) {
            return InventoryResult::StackLimitMismatch;
        }
        const std::int64_t available = item.max_stack_size - stack.quantity;
        remaining -= std::min(remaining, available);
    }

    const auto required_slots = static_cast<std::size_t>(
        (remaining + item.max_stack_size - 1) / item.max_stack_size);
    const auto free_slots = static_cast<std::size_t>(slot_capacity_) - stacks_.size();
    if (required_slots > free_slots) {
        return InventoryResult::CapacityExceeded;
    }

    // Complete all allocations before changing quantities in existing stacks.
    std::vector<ItemStack> additions;
    additions.reserve(required_slots);
    while (remaining > 0) {
        const auto added = static_cast<std::int32_t>(
            std::min(remaining, static_cast<std::int64_t>(item.max_stack_size)));
        additions.push_back({item, added});
        remaining -= added;
    }
    stacks_.reserve(stacks_.size() + required_slots);

    remaining = quantity;
    for (auto& stack : stacks_) {
        if (stack.item.id != item.id || remaining == 0) {
            continue;
        }
        const auto added = static_cast<std::int32_t>(
            std::min(remaining, static_cast<std::int64_t>(item.max_stack_size - stack.quantity)));
        stack.quantity += added;
        remaining -= added;
    }

    for (auto& stack : additions) {
        stacks_.push_back(std::move(stack));
    }

    return InventoryResult::Success;
}

InventoryResult Inventory::RemoveItem(std::string_view item_id, std::int32_t quantity) {
    if (item_id.empty()) {
        return InventoryResult::InvalidItemId;
    }
    if (quantity <= 0) {
        return InventoryResult::InvalidQuantity;
    }
    if (GetItemCount(item_id) < quantity) {
        return InventoryResult::InsufficientQuantity;
    }

    auto remaining = quantity;
    for (auto it = stacks_.rbegin(); it != stacks_.rend() && remaining > 0; ++it) {
        auto& stack = *it;
        if (std::string_view{stack.item.id} != item_id || remaining == 0) {
            continue;
        }
        const auto removed = std::min(remaining, stack.quantity);
        stack.quantity -= removed;
        remaining -= removed;
    }

    // Delay compaction until item_id is no longer used; it may refer to a stored ID.
    stacks_.erase(std::remove_if(stacks_.begin(), stacks_.end(), [](const ItemStack& stack) {
        return stack.quantity == 0;
    }), stacks_.end());

    return InventoryResult::Success;
}

std::uint32_t Inventory::GetSlotCapacity() const noexcept {
    return slot_capacity_;
}

std::size_t Inventory::GetUsedSlotCount() const noexcept {
    return stacks_.size();
}

std::int64_t Inventory::GetItemCount(std::string_view item_id) const noexcept {
    std::int64_t total = 0;
    for (const auto& stack : stacks_) {
        if (std::string_view{stack.item.id} == item_id) {
            total += stack.quantity;
        }
    }
    return total;
}

const std::vector<ItemStack>& Inventory::GetStacks() const noexcept {
    return stacks_;
}

} // namespace gamefoundation
