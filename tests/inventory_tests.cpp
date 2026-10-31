#include <gamefoundation/inventory.hpp>

#include <cstdint>
#include <exception>
#include <iostream>
#include <iterator>
#include <limits>
#include <map>
#include <random>
#include <stdexcept>
#include <string>
#include <string_view>

namespace {

using gamefoundation::Inventory;
using gamefoundation::InventoryResult;
using gamefoundation::ItemDefinition;

const ItemDefinition potion{"potion", 10};
const ItemDefinition sword{"sword", 1};

void Require(bool condition, const char* message) {
    if (!condition) {
        throw std::runtime_error(message);
    }
}

void RequireStack(const Inventory& inventory, std::size_t index, std::string_view id,
                  std::int32_t quantity, std::int32_t limit) {
    Require(index < inventory.GetStacks().size(), "Expected stack does not exist");
    const auto& stack = inventory.GetStacks()[index];
    Require(std::string_view{stack.item.id} == id, "Unexpected item ID");
    Require(stack.quantity == quantity, "Unexpected stack quantity");
    Require(stack.item.max_stack_size == limit, "Unexpected stack limit");
}

void EmptyInventory() {
    const Inventory inventory(3);
    Require(inventory.GetSlotCapacity() == 3, "Unexpected slot capacity");
    Require(inventory.GetUsedSlotCount() == 0, "New inventory must be empty");
    Require(inventory.GetItemCount("potion") == 0, "Missing item count must be zero");
    Require(inventory.GetStacks().empty(), "New inventory must have no stacks");
}

void AddItem() {
    Inventory inventory(2);
    Require(inventory.AddItem(potion, 4) == InventoryResult::Success, "Add failed");
    Require(inventory.GetItemCount("potion") == 4, "Unexpected item count");
    RequireStack(inventory, 0, "potion", 4, 10);
}

void FillExistingStacks() {
    Inventory inventory(3);
    Require(inventory.AddItem(potion, 8) == InventoryResult::Success, "Initial add failed");
    Require(inventory.AddItem(potion, 7) == InventoryResult::Success, "Second add failed");
    Require(inventory.GetUsedSlotCount() == 2, "Expected two stacks");
    RequireStack(inventory, 0, "potion", 10, 10);
    RequireStack(inventory, 1, "potion", 5, 10);
}

void DistinctItemIds() {
    Inventory inventory(3);
    Require(inventory.AddItem(potion, 3) == InventoryResult::Success, "Potion add failed");
    Require(inventory.AddItem({"ether", 10}, 4) == InventoryResult::Success, "Ether add failed");
    Require(inventory.GetUsedSlotCount() == 2, "Different IDs must not share a stack");
    Require(inventory.GetItemCount("potion") == 3, "Potion count changed");
    Require(inventory.GetItemCount("ether") == 4, "Unexpected ether count");
}

void NonStackableItems() {
    Inventory inventory(2);
    Require(inventory.AddItem(sword, 2) == InventoryResult::Success, "Sword add failed");
    Require(inventory.GetUsedSlotCount() == 2, "Each sword needs a slot");
    RequireStack(inventory, 0, "sword", 1, 1);
    RequireStack(inventory, 1, "sword", 1, 1);
    Require(inventory.AddItem(sword, 1) == InventoryResult::CapacityExceeded, "Must reject overflow");
}

void FillStackWhenNoFreeSlots() {
    Inventory inventory(1);
    Require(inventory.AddItem(potion, 4) == InventoryResult::Success, "Initial add failed");
    Require(inventory.AddItem(potion, 6) == InventoryResult::Success, "Partial stack has space");
    Require(inventory.GetUsedSlotCount() == 1, "Must reuse the existing stack");
    RequireStack(inventory, 0, "potion", 10, 10);
}

void CapacityFailureIsAtomic() {
    Inventory inventory(2);
    Require(inventory.AddItem(potion, 8) == InventoryResult::Success, "Potion add failed");
    Require(inventory.AddItem(sword, 1) == InventoryResult::Success, "Sword add failed");
    Require(inventory.AddItem(potion, 3) == InventoryResult::CapacityExceeded, "Must reject entire add");
    Require(inventory.GetUsedSlotCount() == 2, "Failure changed used slots");
    RequireStack(inventory, 0, "potion", 8, 10);
    RequireStack(inventory, 1, "sword", 1, 1);
}

void ZeroCapacity() {
    Inventory inventory(0);
    Require(inventory.AddItem(potion, 1) == InventoryResult::CapacityExceeded, "Zero capacity must reject add");
    Require(inventory.GetStacks().empty(), "Failed add changed the inventory");
}

void RemoveAcrossStacks() {
    Inventory inventory(3);
    Require(inventory.AddItem(potion, 25) == InventoryResult::Success, "Initial add failed");
    Require(inventory.RemoveItem("potion", 12) == InventoryResult::Success, "Remove failed");
    Require(inventory.GetItemCount("potion") == 13, "Unexpected remaining count");
    Require(inventory.GetUsedSlotCount() == 2, "Empty stack must be removed");
    RequireStack(inventory, 0, "potion", 10, 10);
    RequireStack(inventory, 1, "potion", 3, 10);
}

void RemovingAllFreesSlots() {
    Inventory inventory(2);
    Require(inventory.AddItem(potion, 20) == InventoryResult::Success, "Initial add failed");
    Require(inventory.RemoveItem("potion", 20) == InventoryResult::Success, "Remove failed");
    Require(inventory.GetStacks().empty(), "All slots must be freed");
    Require(inventory.AddItem(sword, 2) == InventoryResult::Success, "Freed slots must be reusable");
}

void InsufficientQuantityIsAtomic() {
    Inventory inventory(2);
    Require(inventory.AddItem(potion, 15) == InventoryResult::Success, "Initial add failed");
    Require(inventory.RemoveItem("potion", 16) == InventoryResult::InsufficientQuantity, "Must reject removal");
    Require(inventory.GetUsedSlotCount() == 2, "Failure changed used slots");
    RequireStack(inventory, 0, "potion", 10, 10);
    RequireStack(inventory, 1, "potion", 5, 10);
}

void MissingItem() {
    Inventory inventory(1);
    Require(inventory.AddItem(potion, 2) == InventoryResult::Success, "Initial add failed");
    Require(inventory.RemoveItem("sword", 1) == InventoryResult::InsufficientQuantity, "Missing item must fail");
    RequireStack(inventory, 0, "potion", 2, 10);
}

void InvalidQuantities() {
    Inventory inventory(2);
    Require(inventory.AddItem(potion, 2) == InventoryResult::Success, "Initial add failed");
    for (const auto quantity : {0, -1, (std::numeric_limits<std::int32_t>::min)()}) {
        Require(inventory.AddItem(potion, quantity) == InventoryResult::InvalidQuantity, "Invalid add accepted");
        Require(inventory.RemoveItem("potion", quantity) == InventoryResult::InvalidQuantity, "Invalid remove accepted");
    }
    RequireStack(inventory, 0, "potion", 2, 10);
}

void InvalidItemDefinition() {
    Inventory inventory(2);
    Require(inventory.AddItem({"", 10}, 1) == InventoryResult::InvalidItemId, "Empty ID accepted");
    Require(inventory.RemoveItem("", 1) == InventoryResult::InvalidItemId, "Empty removal ID accepted");
    Require(inventory.AddItem({"potion", 0}, 1) == InventoryResult::InvalidStackLimit, "Zero stack limit accepted");
    Require(inventory.AddItem({"potion", -1}, 1) == InventoryResult::InvalidStackLimit, "Negative stack limit accepted");
    Require(inventory.GetStacks().empty(), "Invalid operations changed the inventory");
}

void StackLimitMismatch() {
    Inventory inventory(3);
    Require(inventory.AddItem(potion, 2) == InventoryResult::Success, "Initial add failed");
    Require(inventory.AddItem({"potion", 5}, 1) == InventoryResult::StackLimitMismatch, "Conflicting limit accepted");
    RequireStack(inventory, 0, "potion", 2, 10);
}

void RedefineRemovedItem() {
    Inventory inventory(1);
    Require(inventory.AddItem(potion, 2) == InventoryResult::Success, "Initial add failed");
    Require(inventory.RemoveItem("potion", 2) == InventoryResult::Success, "Remove failed");
    Require(inventory.AddItem({"potion", 5}, 5) == InventoryResult::Success, "Removed definitions are not retained");
    RequireStack(inventory, 0, "potion", 5, 5);
}

void LargeQuantities() {
    const auto maximum = (std::numeric_limits<std::int32_t>::max)();
    Inventory inventory(2);
    const ItemDefinition item{"large", maximum};
    Require(inventory.AddItem(item, maximum) == InventoryResult::Success, "First large add failed");
    Require(inventory.AddItem(item, maximum) == InventoryResult::Success, "Second large add failed");
    Require(inventory.GetItemCount("large") == 2LL * maximum, "Item count overflowed");
    Require(inventory.AddItem(item, 1) == InventoryResult::CapacityExceeded, "Large full inventory accepted add");
    Require(inventory.RemoveItem("large", maximum) == InventoryResult::Success, "Large remove failed");
    Require(inventory.GetItemCount("large") == maximum, "Unexpected large remaining count");
}

void AddUsingExistingDefinition() {
    Inventory inventory(2);
    Require(inventory.AddItem(potion, 5) == InventoryResult::Success, "Initial add failed");
    const auto& definition = inventory.GetStacks().front().item;
    Require(inventory.AddItem(definition, 10) == InventoryResult::Success, "Aliased definition add failed");
    RequireStack(inventory, 0, "potion", 10, 10);
    RequireStack(inventory, 1, "potion", 5, 10);
}

void RemoveUsingExistingId() {
    Inventory inventory(2);
    Require(inventory.AddItem(potion, 2) == InventoryResult::Success, "Potion add failed");
    Require(inventory.AddItem(sword, 1) == InventoryResult::Success, "Sword add failed");
    const std::string_view id = inventory.GetStacks().front().item.id;
    Require(inventory.RemoveItem(id, 2) == InventoryResult::Success, "Aliased ID removal failed");
    Require(inventory.GetUsedSlotCount() == 1, "Unexpected remaining slot count");
    RequireStack(inventory, 0, "sword", 1, 1);
}

void RepeatedOperationsMatchModel() {
    const ItemDefinition items[] = {{"potion", 10}, {"sword", 1}, {"gem", 4}};
    Inventory inventory(7);
    std::map<std::string, std::int64_t> counts;
    std::mt19937 random(42);

    for (int step = 0; step < 500; ++step) {
        const auto& item = items[random() % std::size(items)];
        const auto quantity = static_cast<std::int32_t>(random() % 12) + 1;
        if (random() % 2 == 0) {
            std::size_t required_slots = 0;
            for (const auto& candidate : items) {
                const auto total = counts[candidate.id] + (candidate.id == item.id ? quantity : 0);
                required_slots += static_cast<std::size_t>(
                    (total + candidate.max_stack_size - 1) / candidate.max_stack_size);
            }
            const auto expected = required_slots <= inventory.GetSlotCapacity()
                ? InventoryResult::Success : InventoryResult::CapacityExceeded;
            Require(inventory.AddItem(item, quantity) == expected, "Add result differs from aggregate model");
            if (expected == InventoryResult::Success) {
                counts[item.id] += quantity;
            }
        } else {
            const auto expected = counts[item.id] >= quantity
                ? InventoryResult::Success : InventoryResult::InsufficientQuantity;
            Require(inventory.RemoveItem(item.id, quantity) == expected, "Remove result differs from aggregate model");
            if (expected == InventoryResult::Success) {
                counts[item.id] -= quantity;
            }
        }

        Require(inventory.GetUsedSlotCount() <= inventory.GetSlotCapacity(), "Slot capacity exceeded");
        for (const auto& candidate : items) {
            Require(inventory.GetItemCount(candidate.id) == counts[candidate.id], "Item totals differ from model");
        }
        for (const auto& stack : inventory.GetStacks()) {
            Require(stack.quantity > 0 && stack.quantity <= stack.item.max_stack_size, "Invalid stack quantity");
        }
    }
}

struct TestCase {
    const char* name;
    void (*run)();
};

} // namespace

int main() {
    const TestCase tests[] = {
        {"empty_inventory", EmptyInventory},
        {"add_item", AddItem},
        {"fill_existing_stacks", FillExistingStacks},
        {"distinct_item_ids", DistinctItemIds},
        {"non_stackable_items", NonStackableItems},
        {"fill_stack_when_no_free_slots", FillStackWhenNoFreeSlots},
        {"capacity_failure_is_atomic", CapacityFailureIsAtomic},
        {"zero_capacity", ZeroCapacity},
        {"remove_across_stacks", RemoveAcrossStacks},
        {"removing_all_frees_slots", RemovingAllFreesSlots},
        {"insufficient_quantity_is_atomic", InsufficientQuantityIsAtomic},
        {"missing_item", MissingItem},
        {"invalid_quantities", InvalidQuantities},
        {"invalid_item_definition", InvalidItemDefinition},
        {"stack_limit_mismatch", StackLimitMismatch},
        {"redefine_removed_item", RedefineRemovedItem},
        {"large_quantities", LargeQuantities},
        {"add_using_existing_definition", AddUsingExistingDefinition},
        {"remove_using_existing_id", RemoveUsingExistingId},
        {"repeated_operations_match_model", RepeatedOperationsMatchModel},
    };

    int failures = 0;
    for (const auto& test : tests) {
        try {
            test.run();
            std::cout << "[PASS] " << test.name << '\n';
        } catch (const std::exception& error) {
            ++failures;
            std::cerr << "[FAIL] " << test.name << ": " << error.what() << '\n';
        }
    }
    std::cout << std::size(tests) << " scenarios, " << failures << " failures\n";
    return failures == 0 ? 0 : 1;
}
