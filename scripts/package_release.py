"""Build a reproducible plugin ZIP; exclude developer and runtime state."""
from pathlib import Path
import hashlib
import zipfile
from check_repository import check, ROOT, PLUGIN

version = check()
allowed_dirs = {'native', 'ui', 'runtime', 'server', 'scripts', 'skills', 'assets', '.codex-plugin'}
allowed_files = {'plugin.json', 'mcp.json', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md'}
files = []
for path in sorted(PLUGIN.rglob('*')):
    relative = path.relative_to(PLUGIN)
    if not path.is_file() or path.is_symlink():
        continue
    if any(part in {'node_modules', '__pycache__', '.git'} for part in relative.parts) or path.suffix == '.pyc':
        continue
    if relative.parts[0] in allowed_dirs or str(relative) in allowed_files:
        files.append(path)
output = ROOT / 'dist'
output.mkdir(exist_ok=True)
archive_path = output / ('codex-quota-mini-' + version + '.zip')
manifest = []
with zipfile.ZipFile(archive_path, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for path in files:
        name = str(Path('codex-quota-mini') / path.relative_to(PLUGIN))
        data = path.read_bytes()
        info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, data)
        manifest.append(hashlib.sha256(data).hexdigest() + '  ' + str(path.relative_to(PLUGIN)))
    info = zipfile.ZipInfo('codex-quota-mini/MANIFEST.sha256', date_time=(2026, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o100644 << 16
    archive.writestr(info, '\n'.join(manifest) + '\n')
digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
archive_path.with_suffix('.zip.sha256').write_text(digest + '  ' + archive_path.name + '\n')
with zipfile.ZipFile(archive_path) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == len(files) + 1
print('Created {} ({} plugin files + checksum manifest)'.format(archive_path.name, len(files)))
