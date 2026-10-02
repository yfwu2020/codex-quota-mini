---
name: quota-mini
description: 启动、停止或检查 Codex Quota Mini 悬浮额度圆。用户要求显示剩余额度、打开沙漏、查看运行状态或演示额度重置时使用。
---

# Codex Quota Mini

This local macOS plugin launches a separate floating indicator. It does not modify or embed into the Codex mini window.

Resolve the plugin root two levels above this skill directory. Run `python3 <plugin-root>/scripts/launch.py start` to build if needed and start the 44 px D4 indicator. First launch requires Apple's Command Line Tools, Python 3 and a signed-in Codex installation. Do not register it for automatic startup unless requested.

The full circle represents weekly remaining quota clockwise from the top. Flat sand represents five-hour remaining quota. The helper reads limits every 30 seconds, also refreshing on app-server quota notifications. Local turn lifecycle metadata updates every 2 seconds; it never reads conversation messages for activity detection. A confirmed five-hour reset flips only the inner hourglass once. Particle animation never spends or drains quota.

Hover over the floating circle to read exact remaining quota, reset time and a live list of running local conversations. Move into the details to use the list; moving out closes the hover view. The circle never opens or pins details on click. Details float in and out with reduced-motion support, automatically choosing an available side of the circle without moving it. Empty session sections and the old footer are omitted. Click a conversation title to open its Codex conversation through its verified local thread deep link. Titles come only from local metadata; conversation messages are never read. Drag it to position it. Right-click the circle to quit. Use `python3 <plugin-root>/scripts/launch.py stop` only when the user asks to stop it.

For status, run `python3 <plugin-root>/scripts/launch.py status`; report snapshot freshness and source. Null quota or activity means unknown. Do not replace it with zero. Local history format changes can make activity unavailable; the animation stops in that case. The activity display covers local desktop conversations, not unconnected remote/cloud conversations.

For a reset demonstration, open `<plugin-root>/ui/preview.html` in the Codex browser panel. Its reset button only changes demo state. Never call an earned-reset redemption tool or create an inference turn to animate, test, or poll this plugin.

No new API key, token extraction, public deployment or browser login is required. Do not print credentials, raw account information, conversation contents or unrelated local metadata.

The plugin contributes native structured settings named 显示悬浮圆 and 全局显示 through its local quota-controls MCP server. In plugin settings, true displays/starts the native circle; false hides it without quitting. Prefer quota_read_settings and quota_update_settings for explicit visibility requests when available. Normal exit records the setting as false. Manual reopening displays the circle again.

The structured settings now include globalDisplay (全局显示), defaulting to true to preserve existing behavior. False displays the circle only while Codex is the foreground app; switching away hides both circle and details, and returning restores it. The visible setting always takes precedence. Update either setting independently and preserve the other. Display scope persists across normal quit and manual reopening.

Global windows remain stationary across Spaces without native show/hide fades. In Codex-only scope, a Codex window must also exist on the current Space. Leaving Codex or changing Spaces hides immediately; only reappearance waits briefly for the new Space to settle. Hover details keep their existing renderer animation.

Sand pace uses local running conversations' cumulative token counter increments multiplied by per-model motion coefficients (all default to 1). The helper samples counters/model metadata every two seconds and averages the recent thirty seconds. Batched counter increments are apportioned over the actual time since the previous changed counter, not the two-second read interval. First-seen history, resumed threads, model changes, counter rollback, account changes, missing data, long gaps and coefficient changes rebase the estimate. Token metadata is read-only; conversation contents and rollouts are not opened. Raw cumulative counts are not published in the state snapshot.

The renderer eases changes with a two-second time constant and keeps gentle flow while a fresh local conversation runs even without new token increments. Sand amount/ring continue to use real quota, polled every thirty seconds. Token-driven pace does not imply per-token streaming precision or official quota/price multipliers.

Structured settings include modelCoefficient / 默认模型系数 (0.001–10), stored separately from display controls in pace.json as defaultCoefficient. Prefer quota_read_model_coefficients and quota_update_model_coefficients for specific model changes. The update accepts defaultCoefficient and/or a models map with partial overrides; a null model value removes that override. All unconfigured models use the default coefficient, initially 1. Changes take effect at the next local two-second sample; do not launch inference or edit managed cache files to set weights. The preview's 落沙 button uses illustrative token rates only.


模型价格系数：0.6.1 起可运行 `python3 scripts/price_coefficients.py` 根据 `assets/api-prices.json` 的已验证价格快照生成参数，再调用 `quota_update_model_coefficients` 应用。以 GPT-6.1 Sol=1，未缓存输入 / 输出各占一半；这仅是动效估算。不要把价格权重说成官方订阅额度倍率。价格快照不自动联网更新；用户手动调整要保留，只有明确要求按价格重新赋值时才重新应用。


定期价格更新（0.7.0）：先调用 `quota_read_api_prices` 读取本机现有价格快照，再打开各行官方 source 核对 Standard 短上下文美元价（DeepSeek 固定高峰、MiMo 海外实时美元），不依据非官方汇总猜价。维持 `baseline=gpt-6.1-sol`、输入输出各半、USD / 百万 text token。只在核实后调用 `quota_apply_api_prices`，它会保留默认系数、与上次价格结果不同的手动系数及清除的覆盖。不要改用 `quota_update_model_coefficients` 批量覆盖手动值。模型下线或价格未知时保留该行旧值并说明，不能设置为零。定期核对本身使用 Codex 模型与联网查询；常驻额度读取和粒子动画不发送推理请求。

落沙调试（0.8.0）：右键悬浮圆选择「调试落沙…」打开原生调试窗，两项滑杆分别控制流速（0–4 倍，0 暂停）和闪耀程度（0–2 倍，0 无闪光）。仅调试期间覆盖自动流速与闪光强度；关闭窗口或取消调试即恢复正常。也可通过 `quota_update_settings` 的 `debugMode`、`sandFlow`、`sandSparkle` 调整，开启调试会打开调试窗。调试可在没有运行会话时演示，但不伪造会话、不改变真实额度、沙量、模型系数，不发送推理请求。保持显示范围、减少动态效果、隐藏及翻转的原有规则；不要为演示开启全局显示或更改模型系数。值保存在独立 `debug.json`，普通退出关闭模式但保留滑杆值。

闪耀方案（0.8.1）：调试窗的「闪耀方案」支持原有柔光（soft）、晶点（crystal）、星芒（star）、流光（trail）、彩砂（color），可通过 `quota_update_settings` 的 `sandSparkleStyle` 切换。各方案仅在 debugMode=true 时生效，0 闪耀强度会关闭所有彩色/白色亮点、星芒与尾迹；关闭调试后恢复原有柔光，不代表选中的方案已正式应用到日常显示。

细砂方案（0.8.4）：调试窗「落沙方案」新增 fine（细砂 · 灰度纹理与流量）。流量 0 暂停，0.01–0.12 逐粒落下，0.25 细流，1 凝实，2–4 粗流；砂粒保持固定下落速度，流量通过粗细和密度表现。透光程度仅调节灰度亮度，不加色彩或独立闪烁。通过 quota_update_settings 的 sandSparkleStyle="fine"、debugMode=true、sandFlow、sandSparkle 调整；关闭调试仍恢复原有自动显示。


主题同步（0.8.5）：悬浮圆、详情窗和调试窗跟随 Codex 的浅色、深色或系统设置，读取 `CODEX_HOME/config.toml` 的 `desktop.appearanceTheme`。配置短暂不可读时保持原有外观；切换主题不重置沙量、落沙或调试参数。不要修改 Codex 的主题设置来控制悬浮圆。
