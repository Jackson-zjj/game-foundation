# TypeScript 核心

本目录保存独立于引擎和平台的 TypeScript 模块，目前已实现基础背包、版本化快照和存档基础。

使用独立的 `package.json` 和 `tsconfig.json` 管理构建；源码按 `src/inventory/` 等系统划分，测试按 `tests/inventory/` 等目录对应组织。

## 操作

需要 Node.js 20 或更新版本。在本目录执行：

```sh
npm ci
npm run build
npm test
```

- `npm run build`：编译为 ES2017 目标的 ESM JavaScript，并生成类型声明到 `dist/`。
- `npm run typecheck`：只进行类型检查。
- `npm test`：自动编译、检查公开类型约束，再使用 Node 自带的测试工具测试编译产物。

运行时测试使用 JavaScript 编写，直接导入已编译的包入口；类型用例使用 TypeScript，只检查不执行。核心实现使用 TypeScript。运行核心不需要 Node API、Cocos、微信 SDK 或第三方运行库；Node 用于开发时的构建和测试。

## 包入口

包名为 `@game-foundation/core`。根入口导出全部核心接口，也可以按模块使用：

- `@game-foundation/core/inventory`：背包、操作结果和快照类型。
- `@game-foundation/core/save`：存档管理器、存储与编解码接口、内存后端。
- `@game-foundation/core/inventory/save`：背包编解码器。

内存后端用于独立验证，不会在重启后保留数据。实际持久化需要由宿主提供 `SaveStorage` 实现。

当前包设置为 `private`，不会直接发布到 npm。需要其他项目接入时，先完成构建，再使用本地包或打包产物；Cocos 项目接入方式尚待实际验证。

公共入口按实际模块逐步导出。模块之间显式声明依赖，核心不直接引用 Cocos、微信或具体游戏项目的代码和资源。

背包模块的共同规则见[背包规则](../../specs/inventory.md)。

完整操作见[构建说明](../docs/building.md)，接口见[背包说明](../docs/inventory.md)和[存档说明](../docs/save.md)。
