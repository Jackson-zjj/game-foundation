# TypeScript 核心构建与测试

## 环境

- Node.js 20 或更新版本，以及随附的 npm。
- TypeScript 5.9.3 作为开发依赖锁定在 `package-lock.json` 中，无需全局安装。

核心运行时只使用标准 JavaScript 能力，不依赖 Node API、Cocos 的 `cc` 模块或微信的 `wx` API。

## 安装与测试

在仓库根目录执行：

```sh
npm --prefix typescript/core ci
npm --prefix typescript/core test
```

Windows PowerShell 如受脚本执行策略限制，可使用 `npm.cmd` 替换 `npm`。

`ci` 根据锁文件安装开发依赖。`test` 先编译源码、检查公开类型约束，再通过 Node 内置测试工具发现并运行测试文件，当前为 `tests/inventory/inventory.test.mjs`。运行时测试通过包入口导入生成的 JavaScript，覆盖共同背包规则、连续操作、JavaScript 参数校验、安全整数边界、数据隔离和模块导出。

`tsconfig.tests.json` 只检查 `tests/inventory/inventory.types.ts`，不生成或运行代码。该用例验证错误参数和修改只读结果会被编译器拒绝；公开类型约束失效时，`@ts-expect-error` 会报告错误。

## 单独编译或类型检查

```sh
npm --prefix typescript/core run build
npm --prefix typescript/core run typecheck
```

`build` 生成 `typescript/core/dist/`，包含 ES2017 目标的 ESM JavaScript 和 `.d.ts` 类型声明；`typecheck` 不生成文件。构建配置仅包含 `src/`，测试不进入运行包。

`node_modules/` 和 `dist/` 已加入 Git 忽略规则，`package-lock.json` 应随源码提交。

## 其他项目接入

包导出根入口 `@game-foundation/core` 和背包子入口 `@game-foundation/core/inventory`。使用方通过本地包或打包产物接入前，应先生成 `dist/`。

当前 `package.json` 设置为 `private`，尚未发布 npm 包。核心不包含 Cocos 组件或微信平台调用；具体 Cocos 版本的包接入、微信构建和真机运行仍需要后续验证。

接口用法见[TypeScript 背包](inventory.md)。
