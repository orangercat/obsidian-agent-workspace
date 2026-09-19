"""Explicit per-session read receipts; display refresh never creates a receipt."""
import argparse
from contextlib import redirect_stdout
from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from obsidian_agent import check, inside, load_snapshot, sha, task_key


def receipt_path(roots, session_id, task_id):
    task_key(task_id)
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,127}', session_id):
        raise ValueError('session-id 格式不正确')
    path = inside(roots['repo'], f'.agent-context/sessions/{session_id}/{task_id}.json')
    if path.resolve().is_relative_to(roots['ob'].resolve()):
        raise ValueError('会话记录不能写入 Obsidian 项目目录')
    return path


def read_session(roots, session_id, task_id):
    path = receipt_path(roots, session_id, task_id)
    snapshot_path = inside(roots['repo'], f'.agent-context/{task_id}/context_snapshot.json')
    raw, _ = load_snapshot(snapshot_path, roots, task_id)
    digest = sha(raw)
    output = io.StringIO()
    with redirect_stdout(output):
        result = check(roots, task_id, show=True, expected_sha=digest)
    if result:
        raise ValueError('上下文过期，先处理变化，再显式读取；未更新会话记录')
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix='.receipt-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(dict(version=1, session_id=session_id, task_id=task_id,
                           snapshot_sha=digest, read_at=datetime.now(timezone.utc).isoformat()), stream)
        if check(roots, task_id, expected_sha=digest, quiet=True):
            raise ValueError('读取期间上下文变化，未更新会话记录')
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)
    return output.getvalue()


def status(roots, session_id, task_id):
    try:
        path = receipt_path(roots, session_id, task_id)
        if not path.exists():
            return {'state': 'unbound'}
        record = json.loads(path.read_text())
        digest = record.get('snapshot_sha')
        if (record.get('version') != 1 or record.get('session_id') != session_id
                or record.get('task_id') != task_id or not isinstance(digest, str)
                or not re.fullmatch('[a-f0-9]{64}', digest)):
            raise ValueError('会话读取记录无效')
        result = check(roots, task_id, expected_sha=digest, quiet=True)
        return {'state': 'stale' if result else 'current', 'snapshot_sha': digest,
                'read_at': record.get('read_at')}
    except (OSError, ValueError, TypeError, AttributeError):
        return {'state': 'error'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['read', 'status'])
    parser.add_argument('task_id')
    parser.add_argument('--session', required=True)
    parser.add_argument('--repo', type=Path, required=True)
    parser.add_argument('--vault-project', type=Path, required=True)
    args = parser.parse_args()
    roots = {'repo': args.repo.expanduser().resolve(), 'ob': args.vault_project.expanduser().resolve()}
    try:
        if args.action == 'read':
            print(read_session(roots, args.session, args.task_id), end='')
            print('SESSION_ID=' + args.session)
            return 0
        result = status(roots, args.session, args.task_id)
        print(json.dumps(result))
        return 0 if result['state'] == 'current' else 1
    except (OSError, ValueError, TypeError, AttributeError) as error:
        print('ERROR: ' + str(error), file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
