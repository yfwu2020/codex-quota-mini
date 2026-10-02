# Codex Quota Mini

一个适用于 macOS 的 44 px 悬浮沙漏，用来查看 Codex 的剩余额度和运行中的本机会话。

**当前版本：0.8.5 · 非 OpenAI 官方插件 · 本地运行**

## 功能

- 闭合圆环表示本周剩余额度，沙漏中的沙量表示 5 小时剩余额度。
- 有本地会话运行时落沙；估算的 token 消耗速度与模型权重影响动效。
- 悬停查看额度、重置时间和运行中的会话；点击会话标题跳转。
- 拖动调整位置，可选择全局显示或仅在 Codex 前台显示。
- 跟随 Codex 的浅色、深色或系统外观设置。
- 确认 5 小时额度重置时，内部沙漏翻转一次。
- 调试面板提供流量、闪耀程度和六种落沙方案；细砂方案通过粗细与密度表现流量。

它是独立悬浮窗，不是 Codex 迷你窗口中的嵌入控件。

## 运行要求

- macOS 13 或更高版本。
- 已安装并登录 Codex 桌面应用。
- Apple Command Line Tools，提供 Swift 编译器和代码签名工具。
- 系统 `/usr/bin/python3` 可用；启动和开发脚本也需要 `python3`。
- Node.js 22 或更高版本，用于本地 MCP 设置服务。

首次启动在本机从源码编译。仓库包含已构建的设置服务，普通安装无需安装 npm 依赖。应用不会注册开机启动。

## 安装和启动

先下载或克隆 [GitHub 仓库](https://github.com/yfwu2020/codex-quota-mini)，再进入仓库根目录：

```sh
git clone https://github.com/yfwu2020/codex-quota-mini.git
cd codex-quota-mini
```

如果尚未安装 Apple Command Line Tools，先运行：

```sh
xcode-select --install
```

注册本地插件市场并安装插件：

```sh
codex plugin marketplace add .
codex plugin add codex-quota-mini@quota-mini-local
python3 plugins/codex-quota-mini/scripts/launch.py start
```

也可以直接注册 GitHub 插件市场：

```sh
codex plugin marketplace add yfwu2020/codex-quota-mini --ref main
codex plugin add codex-quota-mini@quota-mini-local
```

安装后，在 Codex 对话中要求启动 Codex Quota Mini；插件技能会从安装目录编译并启动悬浮圆。

打开 Codex 的插件设置，搜索 **Codex Quota Mini**，即可使用“显示悬浮圆”“全局显示”和调试设置。

也可以直接手动控制：

```sh
python3 plugins/codex-quota-mini/scripts/launch.py start
python3 plugins/codex-quota-mini/scripts/launch.py stop
python3 plugins/codex-quota-mini/scripts/launch.py status
```

`status` 会输出当前的本地状态，可能包含运行中会话的标题；分享输出前请自行检查。右键悬浮圆可打开调试面板或退出。关闭“显示悬浮圆”只隐藏窗口，右键退出则结束应用和帮助程序。

## 预览

在浏览器中打开 [演示页面](plugins/codex-quota-mini/ui/preview.html)。它使用示例数据，可以演示额度变化、落沙和沙漏翻转，不会消耗真实额度或兑换额度重置。

[开发阶段的浅色截图](plugins/codex-quota-mini/docs/44px-preview.png) · [深色截图](plugins/codex-quota-mini/docs/dark-preview.png) · [落沙演示](plugins/codex-quota-mini/docs/sand-glints-preview.gif)

这些图片是早期版本的示例；当前外观和交互以代码及演示页面为准。

## 数据和限制

额度通过 Codex app-server 的只读账户及额度接口获取，约每 30 秒刷新，并响应额度更新通知。会话活动与 token 累计计数约每 2 秒从本机数据库的元数据读取；主题设置约每 0.5 秒检查一次。插件不会读取聊天消息正文，不会发送推理请求，也不会调用额度重置兑换。

本机状态和设置保存在 `~/Library/Application Support/Codex Quota Mini/`；这些文件不在仓库中。详见 [数据处理说明](docs/DATA_HANDLING.md)。

会话列表覆盖本地桌面会话，不包含未连接的远程或云端会话。Codex 的本地数据库结构变化可能使活动信息不可用；此时显示未知状态并停止自动落沙。

沙量和圆环以接口返回的额度为准。落沙速度是估算，不等于实时账单或官方订阅额度倍率。API 价格快照属于静态参考数据，仓库不会自动创建价格更新任务。

## 文件结构

```text
.agents/plugins/marketplace.json    本地／Git 插件市场入口
plugins/codex-quota-mini/
  plugin.json                     通用插件清单
  .codex-plugin/plugin.json        Codex 插件清单
  mcp.json                        本地设置服务入口
  native/                         macOS 悬浮窗和调试窗
  ui/                             圆环、沙漏、落沙与演示
  runtime/                        额度、活动、token、主题读取
  runtime/vendor/                 Tomli 及其许可证
  server/                         MCP 设置服务源码与构建文件
  scripts/                        编译、启动与价格权重工具
  skills/                         Codex 使用说明
  assets/                         图标与 API 价格快照
  tests/                          后端、界面、协议与原生检查
  docs/                           历史示例截图
docs/                             文件清单、开发和发布说明
scripts/                          仓库检查与发行包生成
.github/workflows/                自动检查配置
```

详细文件清单见 [FILES.md](docs/FILES.md)，历史版本说明见 [CHANGELOG.md](docs/CHANGELOG.md)，本次验证结果见 [VERIFICATION.md](docs/VERIFICATION.md)。

## 开发和发行

```sh
npm ci
npm --prefix plugins/codex-quota-mini/server ci
npx playwright install chromium
npm run build
npm test
npm run test:browser
npm run check
npm run package
```

原生窗口测试需在 macOS 上运行；详见 [开发说明](docs/DEVELOPMENT.md)。发行包输出到忽略版本控制的 `dist/`。

GitHub 发布前的账号、许可证和说明事项见 [发布准备](docs/PUBLISHING.md)。仓库地址为 https://github.com/yfwu2020/codex-quota-mini；GitHub 分发不表示上架 OpenAI 官方插件目录。

## 许可证

项目采用 [MIT 许可证](LICENSE)，允许修改、分发和商用，需保留版权与许可声明。第三方组件保留各自的许可证，详见 [第三方声明](docs/THIRD_PARTY_NOTICES.md)。
