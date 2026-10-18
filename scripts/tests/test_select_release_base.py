from pathlib import Path
import runpy
import unittest


select_release_base = runpy.run_path(
    Path(__file__).resolve().parents[1] / 'select-release-base.py'
)['select_release_base']


def release(tag, **options):
    return {'tag_name': tag, 'draft': False, 'prerelease': False, **options}


class ReleaseBaseTest(unittest.TestCase):
    def test_minor_release_uses_previous_patch(self):
        releases = [release(tag) for tag in ['v0.20.0', 'v0.21.2', 'v0.21.1', 'v0.22.0']]
        self.assertEqual(select_release_base('v0.22.0', releases), 'v0.21.2')

    def test_ignores_drafts_prereleases_and_non_version_tags(self):
        releases = [
            release('v0.21.2'), release('v0.21.3', draft=True),
            release('v0.21.4', prerelease=True), release('v0.22.0-rc.1'), release('nightly'),
        ]
        self.assertEqual(select_release_base('v0.22.0', releases), 'v0.21.2')

    def test_hotfix_ignores_newer_minor_and_compares_numerically(self):
        releases = [release(tag) for tag in ['v0.22.0', 'v0.21.9', 'v0.21.10']]
        self.assertEqual(select_release_base('v0.21.11', releases), 'v0.21.10')

    def test_rc_uses_previous_stable_cycle(self):
        releases = [release('v0.21.2'), release('v0.22.0'), release('v0.22.0-rc.1')]
        self.assertEqual(select_release_base('v0.22.0-rc.2', releases), 'v0.21.2')

    def test_missing_predecessor_fails(self):
        with self.assertRaises(ValueError):
            select_release_base('v0.22.0', [release('v0.22.0')])

    def test_invalid_tag_fails(self):
        with self.assertRaises(ValueError):
            select_release_base('vbad.tag', [release('v0.21.2')])


if __name__ == '__main__':
    unittest.main()
