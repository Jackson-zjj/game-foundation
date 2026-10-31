add_library(gamefoundation_core INTERFACE)
add_library(GameFoundation::Core ALIAS gamefoundation_core)

add_subdirectory(inventory)
target_link_libraries(gamefoundation_core INTERFACE GameFoundation::Inventory)
