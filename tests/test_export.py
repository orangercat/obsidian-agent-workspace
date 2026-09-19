import tempfile
import unittest
from pathlib import Path
from export_workspace import export, metadata

class ExportTests(unittest.TestCase):
    def test_export_read_only_and_boundaries(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)/'notes'; root.mkdir(); (root/'tasks').mkdir()
            task=root/'tasks'/'one.md';task.write_text('---\nstatus: active\nowner: "Agent A"\n---\n# Example\nBody')
            before=task.read_bytes()
            result=export(root,'Demo')
            self.assertEqual(result['tasks'][0]['status'],'active')
            self.assertEqual(task.read_bytes(),before)
            self.assertNotIn(str(root),str(result))
            task.write_text('# Legacy\n状态：done')
            self.assertEqual(export(root,'Demo')['tasks'][0]['status'],'unknown')
            outside=Path(directory)/'secret.md';outside.write_text('private')
            (root/'escape.md').symlink_to(outside)
            with self.assertRaises(ValueError): export(root,'Demo')
    def test_fields(self):
        for body in ['---\nstatus: done\nstatus: active\n---\n', '---\nowner: [a,b]\n---\n', '---\nstatus: done']:
            with self.assertRaises(ValueError):metadata(body)

    def test_template_and_legacy_filename_do_not_break_import(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); (root/'tasks').mkdir()
            (root/'tasks'/'_模板.md').write_text('---\ntype: project-task-template\n---\n# 模板')
            (root/'tasks'/'中文任务.md').write_text('# 原有任务')
            result=export(root,'Demo',root,'session-test')
            self.assertEqual(len(result['notes']),1)
            self.assertEqual(len(result['tasks']),1)
            self.assertEqual(result['tasks'][0]['status'],'unknown')
            self.assertEqual(result['tasks'][0]['context']['state'],'error')
