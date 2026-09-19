"""Human-editable Obsidian context for cooperating agents. No runtime dependencies."""

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import sys
import tempfile


OVERVIEW = 'context.md'
INDEX = 'index.md'
REQUIRED = ['repo:AGENTS.md', 'repo:README.md', f'ob:{OVERVIEW}', f'ob:{INDEX}']


def sha(data):
    return hashlib.sha256(data).hexdigest()


def inside(root, relative):
    if Path(relative).is_absolute() or '..' in Path(relative).parts:
        raise ValueError(f'路径必须是根目录内相对路径：{relative}')
    path = root / relative
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError(f'软链越界：{relative}')
    return path


def source_path(roots, key):
    scope, separator, relative = key.partition(':')
    if not separator or scope not in roots or not relative:
        raise ValueError(f'来源须为 repo:相对路径 或 ob:相对路径：{key}')
    return inside(roots[scope], relative)


def task_key(task_id):
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,79}', task_id):
        raise ValueError('task-id 仅允许小写英文、数字、下划线、连字符，最多80字符')
    return f'ob:tasks/{task_id}.md'


def read_sources(roots, keys):
    result = {}
    for key in keys:
        data = source_path(roots, key).read_bytes()
        if not data.strip():
            raise ValueError(f'来源为空：{key}')
        result[key] = data
    return result


def load_snapshot(path, roots, task_id):
    raw = path.read_bytes()
    snapshot = json.loads(raw)
    if (snapshot.get('schema_version') != 1 or snapshot.get('task_id') != task_id
            or snapshot.get('roots') != {k: str(v) for k, v in roots.items()}):
        raise ValueError('快照版本、任务或根目录不匹配')
    sources = snapshot.get('sources')
    required = set(REQUIRED + [task_key(task_id)])
    if not isinstance(sources, dict) or not required.issubset(sources):
        raise ValueError('快照缺少必需来源，不能判定为有效')
    for key, digest in sources.items():
        source_path(roots, key)
        if not isinstance(digest, str) or not re.fullmatch('[a-f0-9]{64}', digest):
            raise ValueError(f'来源 SHA 无效：{key}')
    return raw, snapshot


@contextmanager
def capture_lock(directory):
    # ponytail: 单机协作锁；跨设备执行须另设唯一协调者，不能把 iCloud 当锁服务。
    directory.mkdir(parents=True, exist_ok=True)
    lock = directory / '.context.lock'
    lock.mkdir()
    try:
        (lock / 'owner.json').write_text(json.dumps({
            'pid': os.getpid(), 'host': socket.gethostname(),
            'created_at': datetime.now(timezone.utc).isoformat(),
        }) + '\n')
        yield
    finally:
        (lock / 'owner.json').unlink(missing_ok=True)
        lock.rmdir()


def capture(roots, task_id, extra_sources, expected_sha=None):
    required = REQUIRED + [task_key(task_id)]
    directory = inside(roots['repo'], f'.agent-context/{task_id}')
    if directory.resolve().is_relative_to(roots['ob'].resolve()):
        raise ValueError('快照目录不能位于 Obsidian 项目目录内')
    path = directory / 'context_snapshot.json'
    with capture_lock(directory):
        old = None
        keys = required + extra_sources
        if path.exists():
            old, previous = load_snapshot(path, roots, task_id)
            if expected_sha != sha(old):
                raise ValueError(f'已有快照，禁止静默刷新。先检查并阅读变更；快照 SHA={sha(old)}')
            keys += list(previous['sources'])  # 刷新不能悄悄丢掉已登记的详情。
        elif expected_sha is not None:
            raise ValueError('快照不存在，不能使用 --expect-sha 刷新')
        content = read_sources(roots, dict.fromkeys(keys))
        snapshot = {
            'schema_version': 1, 'task_id': task_id,
            'captured_at': datetime.now(timezone.utc).isoformat(),
            'roots': {k: str(v) for k, v in roots.items()},
            'sources': {k: sha(v) for k, v in content.items()},
        }
        raw = (json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n').encode()
        # 保存旧快照后再替换；不写人维护的笔记，不复制来源正文。
        if old is not None:
            archive = directory / f'context_snapshot.{sha(old)}.json'
            if not archive.exists():
                with archive.open('xb') as stream:
                    stream.write(old)
        fd, name = tempfile.mkstemp(prefix='.context-', dir=directory)
        try:
            with os.fdopen(fd, 'wb') as stream:
                stream.write(raw)
                stream.flush()
                os.fsync(stream.fileno())
            again = read_sources(roots, content)
            if any(sha(again[k]) != snapshot['sources'][k] for k in content):
                raise ValueError('记录期间来源发生变化，未更新快照，请重新读取')
            os.replace(name, path)
            if check(roots, task_id, expected_sha=sha(raw), quiet=True):
                raise ValueError('快照已保存但来源随后变化；当前快照已过期，须重读后显式刷新')
        finally:
            Path(name).unlink(missing_ok=True)
    return path


def check(roots, task_id, show=False, expected_sha=None, quiet=False):
    path = inside(roots['repo'], f'.agent-context/{task_id}/context_snapshot.json')
    raw, snapshot = load_snapshot(path, roots, task_id)
    emit = (lambda *args: None) if quiet else print
    if expected_sha is not None and expected_sha != sha(raw):
        emit('STALE：快照已被刷新，必须重新读取；不能沿用其它 Agent 的基线。')
        return 1
    content = read_sources(roots, snapshot['sources'])
    again = read_sources(roots, content)
    changed = [k for k in content if sha(content[k]) != snapshot['sources'][k]
               or content[k] != again[k]]
    if path.read_bytes() != raw:
        emit('STALE：检查期间快照被刷新，请重新读取。')
        return 1
    if changed:
        emit('STALE：停止依据旧上下文写回；先阅读以下来源的变化：')
        emit('\n'.join(changed))
        emit(f'旧快照 SHA={sha(raw)}')
        return 1
    emit(f'CURRENT：{len(content)} 个已登记来源在本次复读时与快照一致（不是研究验收）。')
    emit(f'SNAPSHOT_SHA={sha(raw)}')
    if show:
        print('\n## L0 来源导航\n')
        print('\n'.join(f'- {key}' for key in content))
        print('\n## L1 项目约定与任务卡（原文；L2 详情按上方来源读取）\n')
        for key in (f'ob:{OVERVIEW}', task_key(task_id)):
            print(content[key].decode('utf-8'))
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['capture', 'check', 'read'])
    parser.add_argument('task_id')
    parser.add_argument('--repo', type=Path, default=Path.cwd(), help='目标代码/文档项目根目录')
    parser.add_argument('--vault-project', type=Path, required=True, help='Vault 中本项目的笔记目录，不是整个 Vault')
    parser.add_argument('--source', action='append', default=[], help='登记额外 repo:路径 / ob:路径')
    parser.add_argument('--expect-sha', help='check 绑定本会话已读快照；capture 显式刷新指定旧快照')
    args = parser.parse_args(argv)
    try:
        task_key(args.task_id)
        roots = {'repo': args.repo.expanduser().resolve(), 'ob': args.vault_project.expanduser().resolve()}
        if not all(root.is_dir() for root in roots.values()):
            raise ValueError('项目和 Obsidian 项目目录必须已存在')
        if args.action == 'capture':
            print(f'CAPTURED：{capture(roots, args.task_id, args.source, args.expect_sha)}')
            return check(roots, args.task_id, show=True)
        if args.source:
            raise ValueError('--source 仅用于 capture')
        if args.action == 'check' and args.expect_sha is None:
            raise ValueError('check 必须带 --expect-sha（本会话 read/capture 输出的 SNAPSHOT_SHA）')
        return check(roots, args.task_id, show=args.action == 'read', expected_sha=args.expect_sha)
    except (OSError, ValueError, TypeError, AttributeError) as error:
        print(f'ERROR：{error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
