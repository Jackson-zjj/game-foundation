# GameFoundation

通用游戏系统框架，采用核心代码与引擎、平台适配层分离的结构。

## 独立构建

需要 CMake 3.20 或更新版本，以及支持 C++17 的编译器。

```sh
cmake -S . -B build/debug
cmake --build build/debug --config Debug
```

## 文档

- [项目定位与设计约定](docs/project-overview.md)：框架职责、系统范围、代码组织以及与游戏项目的复用方式。
- [独立核心构建](docs/building.md)：环境要求、构建命令和 CMake 接入方式。
