# Codex Quota Mini 插件包

当前版本：0.8.6。安装、使用、开发和文件清单见仓库根目录的 [README](../../README.md)。

- `native/`：macOS 悬浮窗、拖动、悬停详情、会话跳转和调试面板。
- `ui/`：44 px 圆环、D4 沙漏、落沙、动画和演示页面。
- `runtime/`：只读额度、活动及 token 元数据，主题同步。
- `server/`：本地 MCP 设置服务和已打包的入口。
- `scripts/`：编译、启动、停止和价格权重计算。
- `skills/`：Codex 调用插件的使用说明。
- `assets/`：图标和静态 API 价格快照。
- `tests/`：Python、浏览器、MCP 协议和原生窗口检查。
- `docs/`：开发阶段的示例截图，均不含会话内容。

此插件为本地 macOS 工具。它不嵌入 Codex 迷你窗口；落沙速度仅为消耗估算，真实额度来自只读额度接口。不会发送推理请求，也不会调用额度重置兑换。

## 从发行 ZIP 手动运行

解压后进入此插件目录。需要 macOS 13+、已登录 Codex、Apple Command Line Tools、Python 3 和 Node.js 22+。

```sh
python3 scripts/launch.py start
python3 scripts/launch.py stop
python3 scripts/launch.py preview
```

首次启动会在本机编译。`server/dist/index.mjs` 是已打包的本地 MCP 服务，不需要运行 npm install。若要在 Codex 设置中使用开关，请按仓库根目录的安装说明注册插件市场并安装；手动启动不自动注册市场。

许可见 [LICENSE](LICENSE)，第三方组件见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。本机账户数据和运行状态不包含在发行包中。
