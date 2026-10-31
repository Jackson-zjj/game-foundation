add_library(gamefoundation_core INTERFACE)
add_library(GameFoundation::Core ALIAS gamefoundation_core)

target_compile_features(gamefoundation_core INTERFACE cxx_std_17)
target_include_directories(gamefoundation_core INTERFACE
    "$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>"
)
