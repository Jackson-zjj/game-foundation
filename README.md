# GameFoundation

通用游戏系统框架，采用核心代码与引擎、平台适配层分离的结构。

## 当前功能

- 可独立构建的 C++ 核心静态库。
- 基础背包：添加、移除、堆叠、容量限制和数量查询。
- 使用 CTest 运行的规则测试，不依赖 Unreal Engine。

UE 适配插件、Lua 接入及其他系统尚未实现。

## 独立构建

需要 CMake 3.20 或更新版本，以及支持 C++17 的编译器。

```sh
cmake -S . -B build/debug
cmake --build build/debug --config Debug
ctest --test-dir build/debug -C Debug --output-on-failure
```

## 文档

- [项目定位与设计约定](docs/project-overview.md)：框架职责、系统范围、代码组织以及与游戏项目的复用方式。
- [独立核心构建](docs/building.md)：环境要求、构建命令和 CMake 接入方式。
- [基础背包](docs/inventory.md)：接口用法、规则和错误处理。
