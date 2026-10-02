from pathlib import Path
import platform
import subprocess
import sys

if platform.system() != 'Darwin':
    raise SystemExit('Native checks require macOS and Apple Command Line Tools.')
ROOT = Path(__file__).resolve().parents[1]
for name in ('popup-layout.py', 'space-visibility.py', 'native-visibility.py', 'native-debug.py', 'native-appearance.py'):
    print('Checking ' + name, flush=True)
    subprocess.run([sys.executable, str(ROOT / 'plugins/codex-quota-mini/tests' / name)], cwd=ROOT, check=True)
