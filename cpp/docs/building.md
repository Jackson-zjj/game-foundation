# C++ 核心构建

## 环境要求

- CMake 3.20 或更新版本。
- 支持 C++17 的编译器。核心以 C++17 为最低要求，使用方可以采用更高标准。
- Windows 可使用 Visual Studio 2022 的 MSVC 编译器和 Windows SDK。

核心使用标准 C++，不要求安装 Unreal Engine，也不需要下载第三方运行库。

如果终端无法识别 `cmake`，可安装 Visual Studio 的 C++ CMake 工具或独立 CMake，并使用能够调用它的终端。也可以通过 CMake 可执行文件的完整路径调用。

## 配置与编译

在仓库根目录执行：

```powershell
cmake -S cpp -B build/cpp/debug
cmake --build build/cpp/debug --config Debug
ctest --test-dir build/cpp/debug -C Debug --output-on-failure
```

Windows 如需明确选择 Visual Studio 和架构，可将配置命令替换为：

```powershell
cmake -S cpp -B build/cpp/debug -G "Visual Studio 17 2022" -A x64
```

Ninja 等单配置生成器通过配置阶段选择构建类型：

```sh
cmake -S cpp -B build/cpp/ninja-debug -G Ninja -DCMAKE_BUILD_TYPE=Debug
cmake --build build/cpp/ninja-debug
ctest --test-dir build/cpp/ninja-debug --output-on-failure
```

不同生成器使用不同的构建目录。`build/` 已加入 Git 忽略规则，生成文件不进入仓库。

源码入口已从仓库根目录移到 `cpp/`。迁移前的 `build/debug` 缓存仍引用旧路径，请使用新的 `build/cpp/debug` 目录重新配置。

头文件引用由 `#include <gamefoundation/inventory.hpp>` 调整为 `#include <inventory/inventory.hpp>`，使用方需同步更新。

## 测试

独立构建 `cpp/` 时，`GAMEFOUNDATION_BUILD_TESTS` 默认开启。测试按模块组织在 `cpp/tests/` 中，通过 CTest 调用，覆盖正常增删、堆叠、容量限制、失败时的数据一致性、非法参数和整数边界，以及连续操作与独立计数模型的对照。

测试检查在 Debug 和 Release 中均生效。Visual Studio 等多配置生成器运行测试时，使用 `-C` 指定与已编译程序一致的配置。

只编译核心库时可以关闭测试：

```sh
cmake -S cpp -B build/cpp/core-only -DGAMEFOUNDATION_BUILD_TESTS=OFF
cmake --build build/cpp/core-only --config Release
```

## 在其他 CMake 项目中使用

```cmake
add_subdirectory(path/to/game-foundation/cpp game-foundation-build)
target_link_libraries(your_target PRIVATE GameFoundation::Inventory)
```

`GameFoundation::Inventory` 是背包模块的独立目标。公共头文件目录与最低 C++ 标准通过目标依赖传递给使用方，头文件使用 `#include <inventory/inventory.hpp>` 引入。

需要当前全部核心模块时，可以链接聚合目标 `GameFoundation::Core`；目前它包含背包模块。新增系统时，为其建立独立目标，按需加入聚合目标，避免仅通过文件夹假定依赖已经隔离。

UE 使用自己的构建系统，仍需单独实现插件和核心代码的编译或链接配置。

作为其他 CMake 项目的子目录使用时，框架测试默认关闭；需要时可以显式开启 `GAMEFOUNDATION_BUILD_TESTS`。
