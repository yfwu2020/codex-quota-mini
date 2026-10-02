from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
for test in sorted((ROOT / 'plugins/codex-quota-mini/tests').glob('*.cjs')):
    print('Checking ' + test.name, flush=True)
    subprocess.run(['node', str(test)], cwd=ROOT, check=True)
