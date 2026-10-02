# 开发说明

当前版本为 0.8.6，包含恢复会话时的运行记录 ID 关联修正。

## 安装开发依赖

Node.js 22+ 和 Python 3.9+。从仓库根目录运行：

```sh
npm ci
npm --prefix plugins/codex-quota-mini/server ci
npx playwright install chromium
```

两个依赖锁文件分别对应浏览器测试和 MCP 服务；`node_modules` 不提交。

## 检查

```sh
npm run build
npm test
npm run test:browser
npm run check
```

浏览器检查使用项目安装的 Playwright 和 Chromium，不依赖作者电脑上的绝对路径。`PLAYWRIGHT_PATH` 可指定另一个 Playwright 安装位置，`CHROME_PATH` 可指定现有 Chromium／Chrome 可执行文件；不设置时使用 Playwright 下载的浏览器。浏览器测试按顺序运行，避免动画时序检查相互争用资源。

`npm test` 包含 Python 数据处理、设置单元测试和隔离目录中的 MCP 协议检查。协议测试会故意验证应用不存在时的启动回滚，产生一条预期的 ENOENT 提示。

## macOS 原生验证

```sh
npm run test:native
```

原生检查编译临时测试程序，验证面板、显示范围、详情位置和主题桥接，不修改 Codex 外观设置；部分检查会短暂显示测试窗口。需要可用的 macOS 图形会话、AppKit、WebKit 和 Apple Command Line Tools。

启动脚本将真实应用构建到当前用户的 Application Support；测试和 CI 不调用真实应用的启动脚本，避免覆盖正在运行的安装。

## 发行包

```sh
npm run check
npm run package
```

生成 `dist/codex-quota-mini-0.8.6.zip` 和相应 SHA-256 校验文件。ZIP 只包含插件所需的清单、技能、原生源码、界面、运行程序、设置服务及第三方声明；不包含测试依赖、账户数据、测试输出或本机编译的应用。

修改功能时同步更新根目录包版本、两个插件清单、服务版本、服务锁文件和原生应用版本，再重建服务和发行包。服务依赖变动后也应更新第三方声明。

## 文档配图

README 的配图由当前界面代码和虚构数据生成，不读取账户、运行中的会话或已安装应用的设置。需要 macOS 图形会话、Apple Command Line Tools、上面的开发依赖，以及用于 GIF 编码的 Pillow：

```sh
python3 -m pip install Pillow
node scripts/render_readme_media.cjs
python3 scripts/update_file_inventory.py
```

输出位于 `docs/images/`。浏览器画面复用 `ui/quota.js` 和 `ui/style.css`，设置示意的标题和说明来自隔离目录中的 MCP 设置接口。原生调试面板使用原有 Swift 代码渲染到图片；四个详情位置来自实际 `placeDetails` 函数。拖动和会话跳转使用明确标注的操作示意，不控制真实 Codex 对话。

生成过程可能短暂显示测试调试窗口；临时数据随生成结束清理，不覆盖已安装的悬浮圆。
