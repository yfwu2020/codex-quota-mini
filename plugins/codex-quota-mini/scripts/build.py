#!/usr/bin/env python3
"""Build the native app from portable plugin source."""
import pathlib
import hashlib
import platform
import plistlib
import shutil
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
SUPPORT = pathlib.Path.home() / 'Library/Application Support/Codex Quota Mini'
APP = SUPPORT / 'Codex Quota Mini.app'


def fingerprint():
    digest = hashlib.sha256()
    for folder in ('native', 'ui', 'runtime', 'scripts'):
        for path in sorted((ROOT / folder).rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts and path.suffix != '.pyc':
                digest.update(str(path.relative_to(ROOT)).encode())
                digest.update(path.read_bytes())
    return digest.hexdigest()


def build():
    SUPPORT.mkdir(parents=True, exist_ok=True, mode=0o700)
    contents = APP / 'Contents'
    binary = contents / 'MacOS/QuotaMini'
    binary.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['xcrun', 'swiftc', '-swift-version', '5', '-O',
                    '-target', f'{platform.machine()}-apple-macosx13.0',
                    str(ROOT / 'native/QuotaMini.swift'), '-o', str(binary),
                    '-framework', 'AppKit', '-framework', 'WebKit'], check=True)
    resources = contents / 'Resources'
    resources.mkdir(exist_ok=True)
    for folder in ('ui', 'runtime'):
        target = resources / folder
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(ROOT / folder, target, ignore=shutil.ignore_patterns('__pycache__'))
    info = {'CFBundleName': 'Codex Quota Mini', 'CFBundleDisplayName': 'Codex Quota Mini',
            'CFBundleIdentifier': 'local.codex.quota-mini', 'CFBundleVersion': '1',
            'CFBundleShortVersionString': '0.8.7', 'CFBundleExecutable': 'QuotaMini',
            'CFBundlePackageType': 'APPL', 'LSUIElement': True, 'NSHighResolutionCapable': True,
            'LSMinimumSystemVersion': '13.0'}
    with open(contents / 'Info.plist', 'wb') as stream:
        plistlib.dump(info, stream)
    (contents / 'source-fingerprint').write_text(fingerprint())
    subprocess.run(['codesign', '--force', '--deep', '--sign', '-', str(APP)], check=True,
                   stdout=subprocess.DEVNULL)
    print(APP)
    return APP


if __name__ == '__main__':
    build()
