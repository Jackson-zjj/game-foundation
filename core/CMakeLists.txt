add_library(gamefoundation_core STATIC
    src/inventory.cpp
)
add_library(GameFoundation::Core ALIAS gamefoundation_core)

set_target_properties(gamefoundation_core PROPERTIES POSITION_INDEPENDENT_CODE ON)

target_compile_features(gamefoundation_core PUBLIC cxx_std_17)
target_include_directories(gamefoundation_core PUBLIC
    "$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>"
)

if(MSVC)
    target_compile_options(gamefoundation_core PRIVATE /W4 /permissive-)
else()
    target_compile_options(gamefoundation_core PRIVATE -Wall -Wextra -Wpedantic)
endif()
