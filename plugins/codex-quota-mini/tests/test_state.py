import importlib.util
import pathlib
import sqlite3
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('quota_state', ROOT / 'runtime/state.py')
state = importlib.util.module_from_spec(SPEC)
if (ROOT / 'runtime/state.py').exists():
    SPEC.loader.exec_module(state)


def limits(used=75, reset=1000, week=60):
    return {'rateLimitsByLimitId': {'other': {'primary': {'usedPercent': 99, 'windowDurationMins': 300}}, 'codex': {
        'primary': {'usedPercent': used, 'windowDurationMins': 300, 'resetsAt': reset},
        'secondary': {'usedPercent': week, 'windowDurationMins': 10080, 'resetsAt': 9000}}}}


class QuotaTests(unittest.TestCase):
    def test_remaining_uses_codex_bucket_and_duration(self):
        s = state.normalize_limits(limits())
        self.assertEqual(s['remainingFiveHour'], 25)
        self.assertEqual(s['remainingWeek'], 40)
        self.assertEqual(s['primaryResetsAt'], 1000)

    def test_missing_or_invalid_usage_is_unknown(self):
        self.assertIsNone(state.normalize_limits({})['remainingFiveHour'])
        self.assertIsNone(state.normalize_limits(limits(used=None))['remainingFiveHour'])
        self.assertIsNone(state.normalize_limits(limits(used=float('nan')))['remainingFiveHour'])
        payload = limits()
        payload['rateLimitsByLimitId']['codex']['primary']['windowDurationMins'] = 60
        self.assertIsNone(state.normalize_limits(payload)['remainingFiveHour'])

    def test_confirmed_reset_increments_once_and_first_load_does_not(self):
        tracker = state.ResetTracker()
        before = state.normalize_limits(limits(used=90))
        self.assertEqual(tracker.observe(before, 'one'), 0)
        self.assertEqual(tracker.observe(before, 'one'), 0)
        after = state.normalize_limits(limits(used=0, reset=2000))
        self.assertEqual(tracker.observe(after, 'one'), 1)
        self.assertEqual(tracker.observe(after, 'one'), 1)

    def test_weekly_changes_corrections_and_account_switch_do_not_reset(self):
        tracker = state.ResetTracker()
        tracker.observe(state.normalize_limits(limits(used=90)), 'one')
        self.assertEqual(tracker.observe(state.normalize_limits(limits(used=80, week=0)), 'one'), 0)
        self.assertEqual(tracker.observe(state.normalize_limits(limits(used=0, reset=2000)), 'two'), 0)

    def test_stale_reset_timestamp_does_not_trigger(self):
        tracker = state.ResetTracker()
        tracker.observe(state.normalize_limits(limits(used=90, reset=2000)), 'one')
        self.assertEqual(tracker.observe(state.normalize_limits(limits(used=0, reset=1000)), 'one'), 0)

    def test_unknown_snapshot_does_not_destroy_reset_baseline(self):
        tracker = state.ResetTracker()
        tracker.observe(state.normalize_limits(limits(used=90)), 'one')
        self.assertEqual(tracker.observe(state.normalize_limits({}), 'one'), 0)
        self.assertEqual(tracker.observe(state.normalize_limits(limits(used=0, reset=2000)), 'one'), 1)

    def test_latest_turn_and_desktop_start_exclude_old_in_progress(self):
        with tempfile.TemporaryDirectory() as folder:
            db = pathlib.Path(folder) / 'history.sqlite'
            c = sqlite3.connect(db)
            c.execute('create table thread_turns(thread_id text, turn_id text, rollout_ordinal integer, status text, started_at integer)')
            c.executemany('insert into thread_turns values (?,?,?,?,?)', [
                ('a','one',1,'inProgress',100), ('a','two',2,'completed',200),
                ('b','one',1,'inProgress',50), ('c','one',1,'inProgress',220)])
            c.commit()
            c.close()
            self.assertEqual(state.active_sessions(db, desktop_started_at=150), 1)

    def test_unsupported_history_is_unknown(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertIsNone(state.active_sessions(pathlib.Path(folder) / 'missing.sqlite', 100))

    def test_active_thread_list_uses_latest_turn_and_current_names(self):
        with tempfile.TemporaryDirectory() as folder:
            history = pathlib.Path(folder) / 'history.sqlite'
            metadata = pathlib.Path(folder) / 'state.sqlite'
            with sqlite3.connect(history) as c:
                c.execute('create table thread_turns(thread_id text, rollout_ordinal integer, status text, started_at integer)')
                c.executemany('insert into thread_turns values (?,?,?,?)', [
                    ('one',1,'inProgress',200), ('two',1,'inProgress',210),
                    ('done',1,'inProgress',220), ('done',2,'completed',230),
                    ('old',1,'inProgress',10)])
            c.close()
            with sqlite3.connect(metadata) as c:
                c.execute('create table threads(id text, name text, title text)')
                c.executemany('insert into threads values (?,?,?)',[
                    ('one','重新命名的会话','旧标题'), ('two',None,'另一个会话')])
            c.close()
            threads = state.active_threads(history,150,metadata)
            self.assertEqual([(t['threadId'],t['title']) for t in threads],
                             [('two','另一个会话'),('one','重新命名的会话')])
            self.assertEqual(threads[0]['startedAt'],210)
            self.assertEqual(state.active_threads(history,None,metadata),[])

    def test_missing_titles_preserve_active_ids(self):
        with tempfile.TemporaryDirectory() as folder:
            history = pathlib.Path(folder) / 'history.sqlite'
            with sqlite3.connect(history) as c:
                c.execute('create table thread_turns(thread_id text, rollout_ordinal integer, status text, started_at integer)')
                c.execute('insert into thread_turns values (?,?,?,?)',('one',1,'inProgress',200))
            c.close()
            self.assertEqual(state.active_threads(history,150,pathlib.Path(folder)/'missing.sqlite')[0]['threadId'],'one')


if __name__ == '__main__':
    unittest.main()
