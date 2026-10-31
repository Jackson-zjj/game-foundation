cmake_minimum_required(VERSION 3.20)

project(GameFoundation VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_EXTENSIONS OFF)

add_subdirectory(core)

set(gamefoundation_tests_default OFF)
if(CMAKE_SOURCE_DIR STREQUAL PROJECT_SOURCE_DIR)
    set(gamefoundation_tests_default ON)
endif()

option(GAMEFOUNDATION_BUILD_TESTS "Build GameFoundation core tests" ${gamefoundation_tests_default})

if(GAMEFOUNDATION_BUILD_TESTS)
    enable_testing()
    add_subdirectory(tests)
endif()
