# TypeScript 版本

该版本面向当前 Cocos Creator 与微信小游戏开发方向。与 C++ 版本共享系统规则，分别维护源码、构建配置和测试。

**当前状态：已实现独立核心包、基础背包、构建与测试。Cocos 组件和微信服务适配尚未实现。**

## 目录约定

```text
typescript/
|-- README.md
|-- core/
|   |-- README.md
|   |-- package.json
|   |-- package-lock.json
|   |-- tsconfig.json
|   |-- tsconfig.tests.json
|   |-- src/
|   |   |-- index.ts
|   |   `-- inventory/
|   |       `-- inventory.ts
|   `-- tests/
|       `-- inventory/
|           |-- inventory.test.mjs
|           `-- inventory.types.ts
|-- adapters/
|   `-- README.md
`-- docs/
    |-- building.md
    `-- inventory.md
```

后续按实际需求增加 `adapters/engines/cocos/` 和 `adapters/platforms/wechat/`。

## 构建与测试

需要 Node.js 20 或更新版本。以下命令在仓库根目录执行：

```sh
npm --prefix typescript/core ci
npm --prefix typescript/core test
```

`test` 会先编译 TypeScript、检查公开类型约束，再通过 Node 自带测试工具验证生成的 JavaScript。Windows PowerShell 如无法执行 `npm.ps1`，可使用 `npm.cmd`。

完整操作见[构建说明](docs/building.md)，使用方式见[背包接口](docs/inventory.md)。

## 依赖约定

- `core/` 作为独立包组织，可以在不启动 Cocos 的环境中构建和测试。
- 核心不引用 Cocos 的 `cc` 模块，也不直接调用微信的 `wx` API。
- 引擎与平台接入代码放在对应适配目录，分别声明自身所需的环境和依赖。
- 模块行为以根目录的 [specs](../specs/inventory.md) 为依据，语言特有的类型和数值限制单独记录。

下一步根据游戏项目需要接入 Cocos 和微信。C++ 与 TypeScript 的功能进度可以不同，支持状态由根目录 README 和各版本文档说明。
