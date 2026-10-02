# 数据处理说明

此说明记录当前实现，不替代发布者未来在网站上发布的隐私政策。

| 数据 | 来源与用途 | 保存位置 |
| --- | --- | --- |
| 剩余额度、重置时间 | Codex app-server 只读接口；绘制沙量和圆环 | 本机 `state.json` |
| 会话 ID、标题、运行状态 | 本机 Codex 数据库元数据；列表和跳转 | 本机状态快照 |
| 会话文件路径 | 仅用于关联恢复会话的运行记录 ID 与当前桌面 ID；不打开该文件 | 只在帮助程序内临时使用 |
| 累计 token 和模型名 | 本机元数据；估算最近落沙速度 | 累计计数只在帮助程序内计算 |
| Codex 外观 | `CODEX_HOME/config.toml` 的 `desktop.appearanceTheme` | 本机 `appearance.json` 只保存主题 |
| 显示、调试、权重设置 | 用户选择 | 本机 `control.json`、`debug.json`、`pace.json`、`prices.json` |
| 悬浮圆位置 | 用户拖动 | macOS 应用偏好 |

状态和设置目录：`~/Library/Application Support/Codex Quota Mini/`。

插件不会读取聊天正文、导出登录凭据或创建推理请求。它没有自建的远程数据收集服务。Codex app-server 本身仍使用 Codex 已有的登录和账户连接。

右键退出或运行停止命令会结束悬浮窗及帮助程序。隐藏窗口不会停止帮助程序。运行数据不自动删除，便于保留偏好。

发布源码或反馈问题时，不上传本机状态目录、Codex 数据库、账户配置、日志或原始 `status` 输出。截图使用演示数据。仓库的忽略规则和检查脚本用于减少误提交。
