# 独立核心构建

## 环境要求

- CMake 3.20 或更新版本。
- 支持 C++17 的编译器。核心以 C++17 为最低要求，使用方可以采用更高标准。
- Windows 可使用 Visual Studio 2022 的 MSVC 编译器和 Windows SDK。

核心使用标准 C++，不要求安装 Unreal Engine，也不需要下载第三方运行库。

如果终端无法识别 `cmake`，可安装 Visual Studio 的 C++ CMake 工具或独立 CMake，并使用能够调用它的终端。也可以通过 CMake 可执行文件的完整路径调用。

## 配置与编译

在仓库根目录执行：

```powershell
cmake -S . -B build/debug
cmake --build build/debug --config Debug
ctest --test-dir build/debug -C Debug --output-on-failure
```

Windows 如需明确选择 Visual Studio 和架构，可将配置命令替换为：

```powershell
cmake -S . -B build/debug -G "Visual Studio 17 2022" -A x64
```

Ninja 等单配置生成器通过配置阶段选择构建类型：

```sh
cmake -S . -B build/debug -G Ninja -DCMAKE_BUILD_TYPE=Debug
cmake --build build/debug
ctest --test-dir build/debug --output-on-failure
```

不同生成器使用不同的构建目录。`build/` 已加入 Git 忽略规则，生成文件不进入仓库。

## 测试

独立构建本仓库时，`GAMEFOUNDATION_BUILD_TESTS` 默认开启。测试通过 CTest 调用，覆盖正常增删、堆叠、容量限制、失败时的数据一致性、非法参数和整数边界，以及连续操作与独立计数模型的对照。

测试检查在 Debug 和 Release 中均生效。Visual Studio 等多配置生成器运行测试时，使用 `-C` 指定与已编译程序一致的配置。

只编译核心库时可以关闭测试：

```sh
cmake -S . -B build/core-only -DGAMEFOUNDATION_BUILD_TESTS=OFF
cmake --build build/core-only --config Release
```

## 在其他 CMake 项目中使用

```cmake
add_subdirectory(path/to/game-foundation game-foundation-build)
target_link_libraries(your_target PRIVATE GameFoundation::Core)
```

公共头文件目录与最低 C++ 标准通过 `GameFoundation::Core` 传递给使用方。UE 使用自己的构建系统，仍需单独实现插件和核心代码的编译或链接配置。

作为其他 CMake 项目的子目录使用时，框架测试默认关闭；需要时可以显式开启 `GAMEFOUNDATION_BUILD_TESTS`。
