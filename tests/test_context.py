"""在临时 Vault 中验证人工修改、缺失来源、重复 capture 与越界拒绝。"""

from contextlib import redirect_stderr, redirect_stdout
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import obsidian_agent as context


class ContextTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        base = Path(self.temp.name).resolve()
        self.roots = {'repo': base / 'repo', 'ob': base / 'vault'}
        self.task = 'example-task'
        for key in context.REQUIRED + [context.task_key(self.task)]:
            path = context.source_path(self.roots, key)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(f'# {key}\n人工原文\n')
        self.snapshot = context.capture(self.roots, self.task, [])

    def check(self, show=False):
        with redirect_stdout(io.StringIO()) as stream:
            result = context.check(self.roots, self.task, show)
        return result, stream.getvalue()

    def test_current_read_and_no_source_writes(self):
        before = context.read_sources(self.roots, context.REQUIRED)
        result, output = self.check(show=True)
        self.assertEqual(result, 0)
        self.assertIn('L1', output)
        self.assertIn('人工原文', output)
        self.assertEqual(before, context.read_sources(self.roots, context.REQUIRED))

    def test_human_edit_stale_then_explicit_refresh(self):
        original = self.snapshot.read_bytes()
        note = context.source_path(self.roots, f'ob:{context.OVERVIEW}')
        note.write_text('# 人工更新\n停止这条研究，先复核输入\n')
        result, output = self.check(show=True)
        self.assertEqual(result, 1)
        self.assertIn('STALE', output)
        self.assertNotIn('## L1', output)
        with self.assertRaises(ValueError):
            context.capture(self.roots, self.task, [])
        self.assertEqual(original, self.snapshot.read_bytes())
        context.capture(self.roots, self.task, [], context.sha(original))
        self.assertEqual(self.check()[0], 0)
        archive = self.snapshot.with_name(f'context_snapshot.{context.sha(original)}.json')
        self.assertEqual(archive.read_bytes(), original)
        self.assertIn('停止这条研究', note.read_text())

    def test_missing_empty_and_repository_changes(self):
        note = context.source_path(self.roots, 'repo:README.md')
        note.write_text('正式状态已变化')
        self.assertEqual(self.check()[0], 1)
        note.write_text('')
        with self.assertRaises(ValueError):
            self.check()
        note.unlink()
        with self.assertRaises(FileNotFoundError):
            self.check()

    def test_extra_sources_survive_refresh(self):
        extra = self.roots['repo'] / 'docs/detail.md'
        extra.parent.mkdir(exist_ok=True)
        extra.write_text('已登记详情')
        context.capture(self.roots, self.task, ['repo:docs/detail.md'],
                        context.sha(self.snapshot.read_bytes()))
        context.capture(self.roots, self.task, [], context.sha(self.snapshot.read_bytes()))
        extra.write_text('详情被修改')
        result, output = self.check()
        self.assertEqual(result, 1)
        self.assertIn('repo:docs/detail.md', output)

    def test_empty_manifest_and_wrong_task_rejected(self):
        original = json.loads(self.snapshot.read_text())
        for field, value in [('sources', {}), ('task_id', 'another-task')]:
            with self.subTest(field=field):
                self.snapshot.write_text(json.dumps({**original, field: value}))
                with self.assertRaises(ValueError):
                    self.check()

    def test_duplicate_capture_and_lock_refuse_without_overwrite(self):
        original = self.snapshot.read_bytes()
        with self.assertRaises(ValueError):
            context.capture(self.roots, self.task, [])
        lock = self.snapshot.parent / '.context.lock'
        lock.mkdir()
        with self.assertRaises(FileExistsError):
            context.capture(self.roots, self.task, [], context.sha(original))
        self.assertEqual(self.snapshot.read_bytes(), original)
        self.assertTrue(lock.exists())

    def test_invalid_paths_and_symlink_escape(self):
        for task in ['../escape', '/absolute', 'x/y', '', 'a' * 81]:
            with self.subTest(task=task), self.assertRaises(ValueError):
                context.task_key(task)
        for key in ['ob:../outside', 'repo:/tmp/file', 'unknown:path']:
            with self.subTest(key=key), self.assertRaises(ValueError):
                context.source_path(self.roots, key)
        link = self.roots['repo'] / 'outside'
        link.symlink_to(self.roots['ob'], target_is_directory=True)
        with self.assertRaises(ValueError):
            context.source_path(self.roots, 'repo:outside/file.md')

    def test_source_changes_during_capture_preserve_old_snapshot(self):
        original = self.snapshot.read_bytes()
        reader = context.read_sources
        calls = 0

        def changing_reader(roots, keys):
            nonlocal calls
            calls += 1
            if calls == 2:
                context.source_path(roots, context.task_key(self.task)).write_text('人刚改了目标')
            return reader(roots, keys)

        with patch.object(context, 'read_sources', changing_reader):
            with self.assertRaisesRegex(ValueError, '记录期间来源发生变化'):
                context.capture(self.roots, self.task, [], context.sha(original))
        self.assertEqual(self.snapshot.read_bytes(), original)
        self.assertEqual(self.check()[0], 1)

    def test_other_agent_refresh_does_not_validate_old_context(self):
        old_sha = context.sha(self.snapshot.read_bytes())
        context.source_path(self.roots, context.task_key(self.task)).write_text('新的任务目标')
        context.capture(self.roots, self.task, [], old_sha)
        with redirect_stdout(io.StringIO()):
            self.assertEqual(context.check(self.roots, self.task, expected_sha=old_sha), 1)
            new_sha = context.sha(self.snapshot.read_bytes())
            self.assertEqual(context.check(self.roots, self.task, expected_sha=new_sha), 0)

    def test_change_between_check_reads_is_stale(self):
        reader = context.read_sources
        calls = 0

        def changing_reader(roots, keys):
            nonlocal calls
            calls += 1
            if calls == 2:
                context.source_path(roots, f'ob:{context.OVERVIEW}').write_text('检查中人工修改')
            return reader(roots, keys)

        with patch.object(context, 'read_sources', changing_reader):
            self.assertEqual(self.check()[0], 1)

    def test_change_at_snapshot_replace_is_not_capture_success(self):
        replace = context.os.replace

        def changing_replace(source, target):
            context.source_path(self.roots, f'ob:{context.OVERVIEW}').write_text('保存瞬间人工修改')
            replace(source, target)

        with patch.object(context.os, 'replace', changing_replace):
            with self.assertRaisesRegex(ValueError, '快照已保存但来源随后变化'):
                context.capture(self.roots, self.task, [], context.sha(self.snapshot.read_bytes()))
        self.assertEqual(self.check()[0], 1)

    def test_cli_requires_session_snapshot_sha(self):
        options = ['--repo', str(self.roots['repo']), '--vault-project', str(self.roots['ob'])]
        with redirect_stdout(io.StringIO()):
            result = context.main(['check', self.task, *options,
                                   '--expect-sha', context.sha(self.snapshot.read_bytes())])
            self.assertEqual(result, 0)
        with redirect_stderr(io.StringIO()):
            self.assertEqual(context.main(['check', self.task, *options]), 2)

    def test_snapshot_directory_cannot_redirect_into_vault(self):
        target = self.roots['repo'] / '.agent-context' / 'another-task'
        target.symlink_to(self.roots['ob'], target_is_directory=True)
        before = sorted(self.roots['ob'].rglob('*'))
        with self.assertRaises(ValueError):
            context.capture(self.roots, 'another-task', [])
        self.assertEqual(before, sorted(self.roots['ob'].rglob('*')))


if __name__ == '__main__':
    unittest.main()
