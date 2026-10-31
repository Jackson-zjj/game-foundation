add_library(gamefoundation_inventory STATIC inventory.cpp)
add_library(GameFoundation::Inventory ALIAS gamefoundation_inventory)

set_target_properties(gamefoundation_inventory PROPERTIES POSITION_INDEPENDENT_CODE ON)

target_compile_features(gamefoundation_inventory PUBLIC cxx_std_17)
target_include_directories(gamefoundation_inventory PUBLIC
    "$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/..>"
)

if(MSVC)
    target_compile_options(gamefoundation_inventory PRIVATE /W4 /permissive-)
else()
    target_compile_options(gamefoundation_inventory PRIVATE -Wall -Wextra -Wpedantic)
endif()
