# GameFoundation

通用游戏系统框架，采用核心代码与引擎、平台适配层分离的结构。

## 代码组织

先按语言分区，再按系统模块组织。C++ 同一模块的头文件与实现放在同一目录，测试按模块归档。

| 目录 | 职责 | 当前状态 |
| --- | --- | --- |
| `cpp/` | C++ 核心、适配层、构建与测试 | 已实现基础背包及测试 |
| `typescript/` | TypeScript 核心与适配层，面向 Cocos 和微信小游戏 | 已实现背包、快照、存档基础、内存后端及测试 |
| `specs/` | 两种语言实现参考的系统规则 | 已整理背包规则与存档协议 |
| `docs/` | 项目定位与整体设计 | 已说明双语言组织方式 |

C++ 和 TypeScript 分别维护实现，共享规则，不要求进度完全一致。Cocos、微信和 UE 适配均尚未实现。

当前存档基础仅在 TypeScript 实现。内存后端不提供跨进程持久化，文件或平台存储后端需要另行实现。

## C++ 独立构建

需要 CMake 3.20 或更新版本，以及支持 C++17 的编译器。

```sh
cmake -S cpp -B build/cpp/debug
cmake --build build/cpp/debug --config Debug
ctest --test-dir build/cpp/debug -C Debug --output-on-failure
```

## TypeScript 独立构建与测试

需要 Node.js 20 或更新版本。在仓库根目录执行，测试命令会自动编译：

```sh
npm --prefix typescript/core ci
npm --prefix typescript/core test
```

Windows PowerShell 如无法执行 `npm.ps1`，可使用 `npm.cmd` 替换 `npm`。

## 文档

- [项目定位与设计约定](docs/project-overview.md)：框架职责、系统范围、代码组织以及与游戏项目的复用方式。
- [背包规则](specs/inventory.md)：两种语言共同遵循的模块行为。
- [存档规则](specs/save.md)：存档槽、协议、存储边界和背包快照格式。
- [C++ 核心构建](cpp/docs/building.md)：环境要求、构建命令和按模块接入方式。
- [C++ 基础背包](cpp/docs/inventory.md)：接口用法、数据表示和错误处理。
- [TypeScript 版本](typescript/README.md)：核心包布局和接入边界。
- [TypeScript 构建](typescript/docs/building.md)：安装、编译和测试命令。
- [TypeScript 基础背包](typescript/docs/inventory.md)：接口用法、安全整数范围和查询快照。
- [TypeScript 存档基础](typescript/docs/save.md)：保存、读取、删除、错误处理与存储接口。
