"""Check the public source copy without opening any account or runtime files."""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / 'plugins/codex-quota-mini'
EXCLUDED = {'.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist', 'build', 'test-results', 'playwright-report'}
PRIVATE_NAMES = {'auth.json', 'config.toml', 'state.json', 'control.json', 'debug.json', 'pace.json', 'prices.json', 'appearance.json'}


def public_files():
    for path in sorted(ROOT.rglob('*')):
        relative = path.relative_to(ROOT)
        if any(part in EXCLUDED for part in relative.parts):
            # Bundled server is intentionally committed for ordinary users.
            if relative != Path('plugins/codex-quota-mini/server/dist/index.mjs'):
                continue
        if path.is_file() or path.is_symlink():
            yield path


def check():
    issues = []
    files = list(public_files())
    for path in files:
        relative = path.relative_to(ROOT)
        if path.is_symlink():
            issues.append(str(relative) + ': symlinks are not allowed in release source')
            continue
        if path.name in PRIVATE_NAMES or path.name.startswith('.env') or path.suffix in {'.sqlite', '.db', '.log', '.pyc', '.pem', '.p12', '.key'}:
            issues.append(str(relative) + ': local data or credential file')
        try:
            text = path.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            continue
        for label, pattern in [('personal absolute path', r'/' + r'Users/' + r'[^/\s]+/'),
                               ('API key pattern', r'\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}')]:
            if re.search(pattern, text):
                issues.append(str(relative) + ': ' + label)
    manifests = [ROOT / 'package.json', PLUGIN / 'plugin.json', PLUGIN / '.codex-plugin/plugin.json', PLUGIN / 'server/package.json']
    records = [json.loads(path.read_text()) for path in manifests]
    version = records[0]['version']
    for path, record in zip(manifests, records):
        if record['version'] != version or record.get('license') != 'MIT':
            issues.append(str(path.relative_to(ROOT)) + ': version/license mismatch')
    lock = json.loads((PLUGIN / 'server/package-lock.json').read_text())
    if lock['version'] != version or lock['packages']['']['version'] != version:
        issues.append('server lock version mismatch')
    if "version:'" + version + "'" not in (PLUGIN / 'server/index.mjs').read_text():
        issues.append('server runtime version mismatch')
    if "'CFBundleShortVersionString': '" + version + "'" not in (PLUGIN / 'scripts/build.py').read_text():
        issues.append('native application version mismatch')
    market = json.loads((ROOT / '.agents/plugins/marketplace.json').read_text())
    for entry in market['plugins']:
        target = (ROOT / entry['source']['path']).resolve()
        if ROOT not in target.parents or not (target / 'plugin.json').is_file():
            issues.append('invalid local marketplace target')
    for required in ['LICENSE', 'docs/THIRD_PARTY_NOTICES.md', 'plugins/codex-quota-mini/LICENSE',
                     'plugins/codex-quota-mini/THIRD_PARTY_NOTICES.md', 'plugins/codex-quota-mini/server/dist/index.mjs']:
        if not (ROOT / required).is_file():
            issues.append('missing ' + required)
    if (ROOT / 'LICENSE').read_bytes() != (PLUGIN / 'LICENSE').read_bytes():
        issues.append('plugin MIT license differs from repository')
    if issues:
        raise SystemExit('\n'.join(issues))
    print('Public source checks PASS: {} files, consistent {}, MIT, no detected personal paths/API keys/local data.'.format(len(files), version))
    return version


if __name__ == '__main__':
    check()
