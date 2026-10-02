#!/usr/bin/env python3
import argparse
import json
import pathlib
import subprocess
from build import APP, ROOT, build, fingerprint

parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['start', 'stop', 'status', 'preview'], nargs='?', default='start')
args = parser.parse_args()
if args.action == 'start':
    stamp = APP / 'Contents/source-fingerprint'
    if not (APP / 'Contents/MacOS/QuotaMini').exists() or not stamp.exists() or stamp.read_text() != fingerprint():
        build()
    subprocess.run(['open', '-g', str(APP)], check=True)
    print('Codex Quota Mini 已启动，可拖动悬浮圆，悬停查看详情，点击会话可直接跳转。')
elif args.action == 'stop':
    subprocess.run(['osascript', '-e', 'tell application id "local.codex.quota-mini" to quit'], check=True)
    print('Codex Quota Mini 已停止。')
elif args.action == 'preview':
    print((ROOT / 'ui/preview.html').as_uri())
else:
    path = pathlib.Path.home() / 'Library/Application Support/Codex Quota Mini/state.json'
    if path.exists():
        print(json.dumps(json.loads(path.read_text()), ensure_ascii=False))
    else:
        print('尚未启动，请先启动 Codex Quota Mini。')
