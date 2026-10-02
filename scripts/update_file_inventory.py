"""List every publishable source file; no absolute paths or generated archives."""
from check_repository import ROOT, public_files

output = ROOT / 'docs/FILES.md'
if not output.exists():
    output.write_text('')
descriptions = {
    'native': 'macOS 悬浮窗、显示范围、详情与调试',
    'ui': '圆环／沙漏绘制、动画或演示页面',
    'runtime': '只读额度、会话／token 元数据、主题同步',
    'server': '本地 MCP 设置服务、依赖锁或打包入口',
    'scripts': '编译、启动、仓库检查或发行工具',
    'skills': 'Codex 使用插件的说明',
    'assets': '插件图标或静态价格快照',
    'tests': '后端、浏览器、协议或原生验证',
    'docs': '说明、历史版本或演示图片',
    '.codex-plugin': 'Codex 插件清单',
    '.agents': '插件市场配置',
    '.github': 'GitHub 自动检查配置',
}
rows = []
for path in public_files():
    relative = path.relative_to(ROOT)
    parts = relative.parts
    section = parts[2] if len(parts) > 2 and parts[0] == 'plugins' else parts[0]
    description = descriptions.get(section, '仓库／插件元数据、说明或许可证')
    rows.append('| `' + str(relative) + '` | ' + description + ' |')
output.write_text('# 发布文件清单\n\n共 ' + str(len(rows)) + ' 个可提交文件。此清单不包含 Git 内部数据、依赖安装目录、缓存和发行 ZIP。\n\n'
                  '| 文件 | 用途 |\n| --- | --- |\n' + '\n'.join(rows) + '\n')
print('Updated FILES.md: ' + str(len(rows)) + ' files')
