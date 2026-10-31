add_executable(gamefoundation_inventory_tests inventory_tests.cpp)
target_link_libraries(gamefoundation_inventory_tests PRIVATE GameFoundation::Inventory)

if(MSVC)
    target_compile_options(gamefoundation_inventory_tests PRIVATE /W4 /permissive-)
else()
    target_compile_options(gamefoundation_inventory_tests PRIVATE -Wall -Wextra -Wpedantic)
endif()

add_test(NAME gamefoundation.inventory COMMAND gamefoundation_inventory_tests)
set_tests_properties(gamefoundation.inventory PROPERTIES TIMEOUT 10)
