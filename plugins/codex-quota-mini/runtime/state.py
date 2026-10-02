"""Quota normalization and reset detection. Never modifies Codex data."""
import math
import sqlite3
from collections import deque
from contextlib import closing


def _number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def normalize_limits(payload):
    buckets = payload.get('rateLimitsByLimitId') or {}
    bucket = buckets.get('codex') or payload.get('rateLimits') or {}
    result = {'remainingFiveHour': None, 'remainingWeek': None,
              'primaryResetsAt': None, 'weeklyResetsAt': None}
    for window in (bucket.get('primary'), bucket.get('secondary')):
        if not isinstance(window, dict):
            continue
        duration = window.get('windowDurationMins')
        if duration not in (300, 10080):
            continue
        key, reset_key = ('remainingFiveHour', 'primaryResetsAt') if duration == 300 else ('remainingWeek', 'weeklyResetsAt')
        used, reset = window.get('usedPercent'), window.get('resetsAt')
        if _number(used):
            result[key] = round(max(0, min(100, 100 - used)), 2)
        if _number(reset) and reset > 0:
            result[reset_key] = reset
    return result


class ResetTracker:
    """A new window plus restored quota confirms a reset; polling never does."""
    def __init__(self):
        self.previous = None
        self.scope = None
        self.serial = 0

    def observe(self, snapshot, scope):
        if scope != self.scope:
            self.scope, self.previous, self.serial = scope, None, 0
        quota, epoch = snapshot.get('remainingFiveHour'), snapshot.get('primaryResetsAt')
        if quota is None or epoch is None:
            return self.serial
        if self.previous is not None:
            old_quota, old_epoch = self.previous
            if epoch < old_epoch:
                return self.serial
            if epoch > old_epoch and quota > old_quota:
                self.serial += 1
        self.previous = (quota, epoch)
        return self.serial


class TokenPaceTracker:
    """Estimate weighted tokens/second from local cumulative counters."""
    def __init__(self):
        self.threads = {}
        self.settings = None
        self.last_observed = None

    def invalidate(self):
        self.threads.clear()
        self.last_observed = None

    def observe(self, counters, timestamp, settings=None):
        settings = normalize_pace_settings(settings)
        if counters is None or not _number(timestamp):
            self.invalidate()
            return None
        if settings != self.settings or (self.last_observed is not None and
                (timestamp < self.last_observed or timestamp - self.last_observed > 60)):
            self.invalidate()
        self.settings, self.last_observed = settings, timestamp
        valid = {row.get('threadId'): row for row in counters if isinstance(row, dict)
                 and isinstance(row.get('threadId'), str) and _number(row.get('totalTokens'))
                 and row['totalTokens'] >= 0}
        self.threads = {key: value for key, value in self.threads.items() if key in valid}
        rate = 0
        for thread_id, row in valid.items():
            tokens, model = row['totalTokens'], row.get('model')
            previous = self.threads.get(thread_id)
            if previous is None or model != previous['model'] or tokens < previous['tokens']:
                self.threads[thread_id] = {'tokens': tokens, 'model': model, 'started': timestamp,
                                          'changed': timestamp, 'intervals': deque()}
                continue
            intervals = previous['intervals']
            if tokens > previous['tokens'] and timestamp > previous['changed']:
                coefficient = settings['models'].get(model, settings['defaultCoefficient'])
                intervals.append((previous['changed'], timestamp, (tokens - previous['tokens']) * coefficient))
                previous.update(tokens=tokens, changed=timestamp)
            cutoff = max(previous['started'], timestamp - 30)
            while intervals and intervals[0][1] <= cutoff:
                intervals.popleft()
            elapsed = timestamp - cutoff
            if elapsed > 0:
                rate += sum(amount * max(0, end - max(start, cutoff)) / (end - start)
                            for start, end, amount in intervals) / elapsed
        return rate if valid or not counters else None


def normalize_pace_settings(settings):
    settings = settings if isinstance(settings, dict) else {}
    valid = lambda value: _number(value) and .001 <= value <= 10
    default = settings.get('defaultCoefficient')
    models = settings.get('models')
    return {'defaultCoefficient': default if valid(default) else 1,
            'models': {key: value for key, value in models.items() if isinstance(key, str) and valid(value)}
                      if isinstance(models, dict) else {}}


def read_token_counters(metadata_path, thread_ids):
    """Select counters/model metadata only; never opens messages or rollouts."""
    if thread_ids is None:
        return None
    if not thread_ids:
        return []
    if metadata_path is None:
        return None
    try:
        with closing(sqlite3.connect(metadata_path.resolve().as_uri() + '?mode=ro', uri=True, timeout=.3)) as connection:
            placeholders = ','.join('?' for _ in thread_ids)
            rows = connection.execute(f'SELECT id, model, tokens_used FROM threads WHERE id IN ({placeholders})', thread_ids).fetchall()
        if len(rows) != len(set(thread_ids)) or any(not _number(tokens) or tokens < 0 for _, _, tokens in rows):
            return None
        return [{'threadId': key, 'model': model, 'totalTokens': tokens} for key, model, tokens in rows]
    except (OSError, sqlite3.Error):
        return None


def active_sessions(history_path, desktop_started_at):
    threads = active_threads(history_path, desktop_started_at)
    return None if threads is None else len(threads)


def active_threads(history_path, desktop_started_at, metadata_path=None):
    """Reads lifecycle and display titles only. None means unknown activity."""
    if desktop_started_at is None:
        return []
    try:
        with closing(sqlite3.connect(history_path.resolve().as_uri() + '?mode=ro', uri=True, timeout=.3)) as connection:
            rows = connection.execute('''
                SELECT t.thread_id, t.status, t.started_at FROM thread_turns t
                WHERE t.started_at >= ?
                AND NOT EXISTS (
                    SELECT 1 FROM thread_turns newer
                    WHERE newer.thread_id = t.thread_id
                    AND newer.rollout_ordinal > t.rollout_ordinal
                ) ORDER BY t.started_at DESC, t.rollout_ordinal DESC, t.thread_id
                ''', (desktop_started_at,)).fetchall()
    except (OSError, sqlite3.Error):
        return None
    titles, identifiers = {}, {}
    if rows and metadata_path is not None:
        try:
            with closing(sqlite3.connect(metadata_path.resolve().as_uri() + '?mode=ro', uri=True, timeout=.3)) as connection:
                columns = {r[1] for r in connection.execute('pragma table_info(threads)')}
                fields = [f'nullif("{key}",\'\')' for key in ('name', 'title') if key in columns]
                expression = ('coalesce(' + ','.join(fields + ["'未命名会话'"]) + ')') if fields else "'未命名会话'"
                has_path = 'rollout_path' in columns
                path_field = 'rollout_path' if has_path else 'NULL'
                records = {}
                # Bound query sizes for older SQLite builds. Read only matching metadata.
                for offset in range(0, len(rows), 128):
                    keys = [r[0] for r in rows[offset:offset + 128]]
                    predicates = ['id IN (' + ','.join('?' for _ in keys) + ')']
                    parameters = list(keys)
                    if has_path:
                        for key in keys:
                            for separator in ('-', '_'):
                                suffix = separator + key + '.jsonl'
                                predicates.append('substr(rollout_path, -?) = ?')
                                parameters.extend((len(suffix), suffix))
                    query = f'SELECT id,{expression},{path_field} FROM threads WHERE ' + ' OR '.join(predicates)
                    for identifier, title, rollout_path in connection.execute(query, parameters):
                        records[identifier] = (title, rollout_path)
                for identifier, (title, _) in records.items():
                    titles[identifier] = title
                for key, _, _ in rows:
                    if key in records:
                        identifiers[key] = key
                        continue
                    # A resumed/copied rollout may keep its original ID in lifecycle
                    # history while the desktop uses a new ID. Never open its contents.
                    suffixes = tuple(separator + key + '.jsonl' for separator in ('-', '_'))
                    matches = [identifier for identifier, (_, rollout_path) in records.items()
                               if isinstance(rollout_path, str) and rollout_path.endswith(suffixes)]
                    if len(matches) == 1:
                        identifiers[key] = matches[0]
        except (OSError, sqlite3.Error):
            pass
    active, seen = [], set()
    for key, status, started_at in rows:
        identifier = identifiers.get(key, key)
        if identifier in seen:
            continue
        seen.add(identifier)
        if status == 'inProgress':
            active.append({'threadId': identifier, 'title': titles.get(identifier) or '未命名会话',
                           'startedAt': started_at})
    return active
