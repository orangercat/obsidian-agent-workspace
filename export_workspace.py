"""Export explicitly selected project notes for the read-only sidebar (stdout only)."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys
from obsidian_agent import inside

STATUSES = {'planned', 'active', 'blocked', 'review', 'done', 'cancelled'}

def metadata(body):
    # ponytail: only plain/JSON-quoted scalar fields; full YAML needs a dedicated parser.
    if not body.startswith('---\n'):
        return {}
    head, separator, _ = body[4:].partition('\n---\n')
    if not separator:
        raise ValueError('未闭合的 frontmatter')
    result = {}
    for line in head.splitlines():
        key, sep, value = line.partition(':')
        if not sep or key not in {'status', 'owner', 'type'}:
            continue
        if key in result:
            raise ValueError('重复字段：' + key)
        value = value.strip()
        if value.startswith('"'):
            value = json.loads(value)
        elif not re.fullmatch(r'[\w .@/-]*', value):
            raise ValueError('status/owner 仅支持纯文本或 JSON 双引号字符串')
        if not isinstance(value, str):
            raise ValueError('字段必须是字符串')
        result[key] = value
    return result

def export(root, project, repo=None, session=None):
    if not root.is_dir():
        raise ValueError('项目笔记目录不存在')
    notes, tasks = [], []
    total_bytes = 0
    for path in sorted(root.rglob('*.md')):
        relative = path.relative_to(root)
        if any(part.startswith('.') for part in relative.parts):
            continue
        with inside(root, str(relative)).open('rb') as stream:
            raw = stream.read(1024 * 1024 + 1)
        total_bytes += len(raw)
        if total_bytes > 8 * 1024 * 1024 or len(notes) + len(tasks) >= 2000:
            raise ValueError('项目超过 8 MB 正文或 2000 篇笔记，请缩小范围')
        if len(raw) > 1024 * 1024:
            raise ValueError('单篇笔记超过 1 MB：' + str(relative))
        body = raw.decode('utf-8-sig').replace('\r\n', '\n')
        title = next((line[2:].strip() for line in body.splitlines() if line.startswith('# ')), path.stem)
        row = dict(id=relative.with_suffix('').as_posix(), title=title, path=relative.as_posix(), body=body)
        fields = metadata(body) if relative.parts[0] == 'tasks' else {}
        if relative.parts[0] == 'tasks' and fields.get('type') != 'project-task-template':
            status = fields.get('status', 'unknown')
            if status not in STATUSES | {'unknown'}:
                raise ValueError('无效任务状态：' + status)
            row.update(status=status, owner=fields.get('owner', ''))
            if repo is not None and session is not None:
                from session_context import status
                row['context'] = status({'repo': repo, 'ob': root}, session, path.stem) if len(relative.parts) == 2 else {'state': 'error'}
            tasks.append(row)
        else:
            notes.append(row)
    result = dict(version=1, project=project, exported_at=datetime.now(timezone.utc).isoformat(), notes=notes, tasks=tasks)
    if len(json.dumps(result, ensure_ascii=False).encode()) > 9 * 1024 * 1024:
        raise ValueError('项目导出超过 9 MB，请缩小项目目录范围')
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vault-project', type=Path, required=True)
    parser.add_argument('--name', required=True)
    parser.add_argument('--repo', type=Path)
    parser.add_argument('--session')
    args = parser.parse_args()
    try:
        print(json.dumps(export(args.vault_project.expanduser().resolve(), args.name, args.repo.expanduser().resolve() if args.repo else None, args.session), ensure_ascii=False))
    except (OSError, ValueError) as error:
        print('ERROR: ' + str(error), file=sys.stderr)
        return 2
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
