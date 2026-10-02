import pathlib
import tempfile
import fcntl
import subprocess
import sys
import threading
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'runtime'))
import bridge


class BridgeTests(unittest.TestCase):
    def test_quick_reopen_waits_for_previous_helper_lock(self):
        with tempfile.TemporaryDirectory() as folder:
            path = pathlib.Path(folder) / 'bridge.lock'
            with open(path, 'w') as previous, open(path, 'w') as new:
                fcntl.flock(previous, fcntl.LOCK_EX | fcntl.LOCK_NB)
                release = threading.Timer(.08, lambda: fcntl.flock(previous, fcntl.LOCK_UN))
                release.start()
                try:
                    self.assertTrue(bridge.acquire_bridge_lock(new, timeout=.5),
                                    'The new helper must take over after the old helper exits')
                finally:
                    release.join()

    def test_live_helper_lock_does_not_allow_duplicate_owner(self):
        with tempfile.TemporaryDirectory() as folder:
            path = pathlib.Path(folder) / 'bridge.lock'
            with open(path, 'w') as previous, open(path, 'w') as new:
                fcntl.flock(previous, fcntl.LOCK_EX | fcntl.LOCK_NB)
                self.assertFalse(bridge.acquire_bridge_lock(new, timeout=.03))

    def test_initialization_failure_reaps_owned_process(self):
        child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'],
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
        try:
            with patch.object(bridge.subprocess, 'Popen', return_value=child), \
                 patch.object(bridge, 'codex_binary', return_value='codex'), \
                 patch.object(bridge.CodexRPC, 'request', side_effect=TimeoutError):
                with self.assertRaises(TimeoutError):
                    bridge.CodexRPC(threading.Event())
            self.assertIsNotNone(child.poll(), 'Initialization failure must reap its child')
        finally:
            if child.poll() is None:
                child.kill()
                child.wait()
            child.stdin.close()
            child.stdout.close()

    def test_account_change_clears_previous_quota_before_fetch(self):
        tracker = bridge.ResetTracker()
        old = {'remainingFiveHour': 12, 'remainingWeek': 34, 'primaryResetsAt': 100,
               'weeklyResetsAt': 200, 'accountScope': 'one', 'quotaUpdatedAt': 10,
               'resetSerial': 1, 'status': 'live', 'weightedTokensPerSecond': 2}
        tracker.observe(old, 'one')
        bridge.apply_account_scope(old, 'two', tracker)
        self.assertEqual(old['accountScope'], 'two')
        self.assertIsNone(old['remainingFiveHour'])
        self.assertIsNone(old['remainingWeek'])
        self.assertIsNone(old['quotaUpdatedAt'])
        self.assertIsNone(old['weightedTokensPerSecond'], 'Account changes clear the previous pace before fetching')
        self.assertEqual(old['resetSerial'], 0)
        old.update(remainingFiveHour=80, status='live')
        bridge.apply_account_scope(old, 'two', tracker)
        self.assertEqual(old['remainingFiveHour'], 80, 'Same-account retry preserves quota')

    def test_shutdown_during_initialization_reaps_owned_process(self):
        child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'],
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
        stop = threading.Event()
        stop.set()
        try:
            with patch.object(bridge.subprocess, 'Popen', return_value=child), \
                 patch.object(bridge, 'codex_binary', return_value='codex'):
                with self.assertRaisesRegex(RuntimeError, 'stopping'):
                    bridge.CodexRPC(threading.Event(), stop)
            self.assertIsNotNone(child.poll())
        finally:
            if child.poll() is None:
                child.kill()
                child.wait()
            child.stdin.close()
            child.stdout.close()


if __name__ == '__main__':
    unittest.main()
