# GitHub 分发与后续发布

仓库：[yfwu2020/codex-quota-mini](https://github.com/yfwu2020/codex-quota-mini)。公开分发；项目采用 MIT 许可证。作者使用 GitHub 账号 yfwu2020。

## 仓库内容

- 0.8.6 插件源码、可安装的本地／Git 市场入口和已构建的设置服务。
- README、安装和开发说明、逐项文件清单、历史版本记录。
- 忽略规则、本机路径和数据检查、发行 ZIP 和校验文件生成脚本。
- 锁定的开发依赖、浏览器检查和 GitHub Actions 自动检查配置。
- MIT 项目许可证和第三方依赖的许可证文本。

## 维护流程

1. 修改源码后，执行开发文档中的构建与检查；更新相应版本和说明。
2. 使用自己的 Git 身份提交，再推送 `main` 或通过分支提交 Pull Request。
3. 在 [Actions](https://github.com/yfwu2020/codex-quota-mini/actions) 确认实际运行结果；本机通过不代表远程 CI 已通过。
4. 如需 Release，使用 `npm run package` 生成 ZIP 和校验文件，再以对应版本创建发布。

使用 [Issues](https://github.com/yfwu2020/codex-quota-mini/issues) 反馈问题时，仅提供演示截图和必要错误信息，不上传本机状态目录、会话标题、账户配置或认证数据。

## 安装

```sh
codex plugin marketplace add yfwu2020/codex-quota-mini --ref main
codex plugin add codex-quota-mini@quota-mini-local
```

安装后可在 Codex 对话中要求启动插件；首次启动从本机源码编译，需要 macOS、Apple Command Line Tools 和 Python。详见根目录 README。

这是 GitHub 分发流程。OpenAI 官方目录的审核和发布是独立流程，当前项目不声明官方认证或官方背书。
