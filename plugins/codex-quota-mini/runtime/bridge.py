"""Read-only local bridge. Does not call inference or redeem reset credits."""
import argparse
import datetime
import fcntl
import hashlib
import json
import os
import pathlib
import queue
import shutil
import signal
import subprocess
import threading
import time
from state import TokenPaceTracker, ResetTracker, active_threads, normalize_limits, normalize_pace_settings, read_token_counters
from appearance import AppearanceMonitor

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = pathlib.Path.home() / 'Library/Application Support/Codex Quota Mini'
CODEX_HOME_PATH = pathlib.Path(os.environ.get('CODEX_HOME', pathlib.Path.home() / '.codex'))


def read_activity():
    candidates = [p for p in CODEX_HOME_PATH.glob('state_[0-9]*.sqlite') if p.stem[6:].isdigit()]
    metadata = max(candidates, key=lambda p: int(p.stem.split('_')[-1]), default=None)
    threads = active_threads(CODEX_HOME_PATH / 'thread_history_1.sqlite', desktop_started_at(), metadata)
    return {'activeThreads': threads, 'activeSessions': None if threads is None else len(threads),
            'activityUpdatedAt': time.time(),
            'tokenCounters': read_token_counters(metadata, None if threads is None else [t['threadId'] for t in threads])}


def read_pace_settings():
    try:
        return normalize_pace_settings(json.loads((DATA / 'pace.json').read_text()))
    except (OSError, ValueError):
        return normalize_pace_settings(None)


def codex_binary():
    for candidate in (os.environ.get('CODEX_CLI_PATH'),
                      '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex',
                      '/Applications/Codex.app/Contents/Resources/codex', shutil.which('codex')):
        if candidate and os.access(candidate, os.X_OK):
            return candidate
    raise RuntimeError('请先安装并登录 Codex')


class CodexRPC:
    def __init__(self, on_update, stop=None):
        self.process = subprocess.Popen([codex_binary(), 'app-server', '--stdio'],
                                        stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.DEVNULL, text=True, bufsize=1)
        self.responses = queue.Queue(maxsize=64)
        self.request_id = 0
        self.on_update = on_update
        self.stop = stop
        threading.Thread(target=self._read, daemon=True).start()
        try:
            self.request('initialize', {'clientInfo': {'name': 'codex_quota_mini', 'version': '0.1.0'},
                                        'capabilities': {}})
            self._send({'method': 'initialized'})
        except BaseException:
            self.close()
            raise

    def _send(self, message):
        self.process.stdin.write(json.dumps(message) + '\n')
        self.process.stdin.flush()

    def _read(self):
        try:
            for line in self.process.stdout:
                try:
                    message = json.loads(line)
                except ValueError:
                    continue
                if message.get('method') in ('account/rateLimits/updated', 'account/updated'):
                    self.on_update.set()
                if 'id' in message:
                    try:
                        self.responses.put_nowait(message)
                    except queue.Full:
                        pass
        finally:
            self.on_update.set()

    def request(self, method, params=None):
        if method not in ('initialize', 'account/read', 'account/rateLimits/read'):
            raise ValueError('This bridge permits only read-only account RPCs')
        self.request_id += 1
        request_id = self.request_id
        self._send({'id': request_id, 'method': method, 'params': params or {}})
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            if self.stop is not None and self.stop.is_set():
                raise RuntimeError('Quota bridge is stopping')
            if self.process.poll() is not None:
                raise RuntimeError('Codex connection closed')
            try:
                message = self.responses.get(timeout=min(1, max(.01, deadline - time.monotonic())))
            except queue.Empty:
                continue
            if message.get('id') == request_id:
                if 'error' in message:
                    raise RuntimeError('无法读取额度，请检查 Codex 登录状态')
                return message.get('result') or {}
        raise TimeoutError('Codex quota refresh timed out')

    def close(self):
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()


def desktop_started_at():
    env = {**os.environ, 'LC_ALL': 'C'}
    output = subprocess.check_output(['ps', '-axo', 'lstart=,comm='], text=True, env=env)
    for line in output.splitlines():
        if line.strip().endswith(('/ChatGPT.app/Contents/MacOS/ChatGPT', '/Codex.app/Contents/MacOS/Codex')):
            try:
                stamp = line[:24].strip()
                return datetime.datetime.strptime(stamp, '%a %b %d %H:%M:%S %Y').timestamp()
            except ValueError:
                continue
    return None


def account_scope(account):
    identity = json.dumps(account.get('account') or {}, sort_keys=True)
    return hashlib.sha256(identity.encode()).hexdigest()[:20]


def apply_account_scope(snapshot, scope, tracker, token_tracker=None):
    if snapshot.get('accountScope') != scope:
        unknown = normalize_limits({})
        snapshot.update(unknown)
        snapshot.update(accountScope=scope, quotaUpdatedAt=None, status='connecting', weightedTokensPerSecond=None,
                        resetSerial=tracker.observe(unknown, scope))
        if token_tracker is not None:
            token_tracker.invalidate()


def write_snapshot(snapshot):
    DATA.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = DATA / 'state.pending'
    with open(temporary, 'w') as stream:
        os.chmod(temporary, 0o600)
        json.dump(snapshot, stream, ensure_ascii=False, allow_nan=False)
    os.replace(temporary, DATA / 'state.json')


def acquire_bridge_lock(stream, timeout=8):
    deadline = time.monotonic() + timeout
    while True:
        try:
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return True
        except BlockingIOError:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return False
            time.sleep(min(.05, remaining))


def run(once=False):
    DATA.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock_file = open(DATA / 'bridge.lock', 'w')
    if not acquire_bridge_lock(lock_file):
        lock_file.close()
        return
    stop, refresh, mutex = threading.Event(), threading.Event(), threading.Lock()
    snapshot = {**normalize_limits({}), 'activeSessions': None, 'activeThreads': None, 'activitySource': 'local-history',
                'status': 'connecting', 'resetSerial': 0, 'quotaUpdatedAt': None,
                'accountScope': None, 'weightedTokensPerSecond': None, 'tokenPaceUpdatedAt': None,
                'tokenPaceSource': 'local-token-counters'}
    tracker, pace, rpc = ResetTracker(), TokenPaceTracker(), None
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: (stop.set(), refresh.set()))

    appearance = AppearanceMonitor(CODEX_HOME_PATH / 'config.toml', DATA / 'appearance.json')
    appearance.refresh()

    def appearance_worker():
        while not stop.wait(.5):
            appearance.refresh()

    theme_worker = threading.Thread(target=appearance_worker, daemon=True)
    if not once:
        theme_worker.start()

    def quota_worker():
        nonlocal rpc
        while not stop.is_set():
            try:
                if rpc is None:
                    rpc = CodexRPC(refresh, stop)
                account = rpc.request('account/read', {'refreshToken': False})
                scope = account_scope(account)
                with mutex:
                    apply_account_scope(snapshot, scope, tracker, pace)
                quota = normalize_limits(rpc.request('account/rateLimits/read'))
                with mutex:
                    observed_at = time.time()
                    snapshot.update(quota)
                    snapshot.update(accountScope=scope, resetSerial=tracker.observe(quota, scope),
                                    status='live', quotaUpdatedAt=observed_at)
            except (OSError, RuntimeError, TimeoutError, ValueError):
                with mutex:
                    snapshot['status'] = 'stale' if snapshot['quotaUpdatedAt'] else 'unavailable'
                if rpc:
                    rpc.close()
                    rpc = None
            if once:
                return
            refresh.clear()
            refresh.wait(30)

    worker = threading.Thread(target=quota_worker, daemon=True)
    worker.start()
    try:
        if once:
            worker.join(45)
            if worker.is_alive():
                raise TimeoutError('Quota initialization timed out')
            activity = read_activity()
            counters = activity.pop('tokenCounters')
            snapshot.update(activity)
            snapshot.update(weightedTokensPerSecond=pace.observe(counters, activity['activityUpdatedAt'], read_pace_settings()),
                            tokenPaceUpdatedAt=activity['activityUpdatedAt'])
            write_snapshot(snapshot)
            print(json.dumps(snapshot, ensure_ascii=False))
            return
        while not stop.is_set():
            activity = read_activity()
            counters = activity.pop('tokenCounters')
            with mutex:
                snapshot.update(activity)
                snapshot.update(weightedTokensPerSecond=pace.observe(counters, activity['activityUpdatedAt'], read_pace_settings()),
                                tokenPaceUpdatedAt=activity['activityUpdatedAt'])
                write_snapshot(snapshot)
            stop.wait(2)
    finally:
        stop.set()
        refresh.set()
        worker.join(5)
        if theme_worker.is_alive():
            theme_worker.join(1)
        if rpc:
            rpc.close()
        lock_file.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    run(args.once)
