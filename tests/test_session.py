import json
from pathlib import Path
import tempfile
import unittest
from obsidian_agent import capture, sha
from session_context import read_session, status

class SessionTests(unittest.TestCase):
    def test_read_receipt_does_not_follow_another_agents_refresh(self):
        with tempfile.TemporaryDirectory() as temp:
            roots = {k: Path(temp)/k for k in ['repo','ob']}
            for root in roots.values(): root.mkdir()
            for name in ['AGENTS.md','README.md']: (roots['repo']/name).write_text('repo')
            for name in ['context.md','index.md']: (roots['ob']/name).write_text('notes')
            (roots['ob']/'tasks').mkdir();(roots['ob']/'tasks/one.md').write_text('task')
            before = {p:p.read_bytes() for p in roots['ob'].rglob('*.md')}
            snapshot = capture(roots,'one',[])
            self.assertEqual(status(roots,'session-a','one')['state'],'unbound')
            self.assertIn('SNAPSHOT_SHA=',read_session(roots,'session-a','one'))
            old = status(roots,'session-a','one')
            self.assertEqual(old['state'],'current')
            (roots['ob']/'context.md').write_text('human edit')
            self.assertEqual(status(roots,'session-a','one')['state'],'stale')
            with self.assertRaises(ValueError):read_session(roots,'session-b','one')
            capture(roots,'one',[],expected_sha=sha(snapshot.read_bytes()))
            self.assertEqual(status(roots,'session-a','one')['state'],'stale')
            self.assertEqual(status(roots,'session-b','one')['state'],'unbound')
            self.assertEqual(status(roots,'session-a','one')['snapshot_sha'],old['snapshot_sha'])
            self.assertEqual(status(roots,'../escape','one')['state'],'error')
            (roots['ob']/'context.md').write_bytes(before[roots['ob']/'context.md'])
            self.assertEqual(before,{p:p.read_bytes() for p in roots['ob'].rglob('*.md')})
