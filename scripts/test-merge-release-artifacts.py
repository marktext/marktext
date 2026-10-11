import runpy
import tempfile
import unittest
from pathlib import Path

import yaml

merge_artifacts = runpy.run_path(str(Path(__file__).with_name('merge-release-artifacts.py')))['merge_artifacts']


class MergeArtifactsTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.source = self.root / 'artifacts'
        self.destination = self.root / 'dist'

    def add_architecture(self, arch, version='0.21.2', platform='mac'):
        folder = self.source / f'{platform}-{arch}'
        folder.mkdir(parents=True)
        name = f'marktext-{platform}-{arch}-{version}.zip' if platform == 'mac' else f'marktext-win-{arch}-{version}-setup.exe'
        (folder / name).write_bytes(b'installer')
        document = {
            'version': version,
            'files': [{'url': name, 'size': 9, 'sha512': f'hash-{arch}'}],
            'path': name,
            'sha512': f'hash-{arch}',
            'releaseDate': '2026-10-11T00:00:00.000Z',
        }
        metadata = 'latest-mac.yml' if platform == 'mac' else 'latest.yml'
        (folder / metadata).write_text(yaml.safe_dump(document))

    def test_both_architectures_survive_with_legacy_x64_fallback(self):
        self.add_architecture('arm64')
        self.add_architecture('x64')
        merge_artifacts(self.source, self.destination)
        document = yaml.safe_load((self.destination / 'latest-mac.yml').read_text())
        self.assertEqual(len(document['files']), 2)
        self.assertIn('-x64-', document['path'])
        self.assertEqual(document['sha512'], 'hash-x64')
        for file in document['files']:
            self.assertTrue((self.destination / file['url']).is_file())

    def test_mixed_versions_cannot_publish(self):
        self.add_architecture('arm64')
        self.add_architecture('x64', '0.21.1')
        with self.assertRaisesRegex(ValueError, 'Conflicting versions'):
            merge_artifacts(self.source, self.destination)

    def test_windows_installers_both_survive(self):
        self.add_architecture('arm64', platform='win')
        self.add_architecture('x64', platform='win')
        merge_artifacts(self.source, self.destination)
        document = yaml.safe_load((self.destination / 'latest.yml').read_text())
        self.assertEqual(len(document['files']), 2)
        self.assertIn('-x64-', document['path'])
        self.assertTrue(all(file['url'].endswith('-setup.exe') for file in document['files']))

    def test_missing_architecture_cannot_publish(self):
        self.add_architecture('arm64')
        with self.assertRaisesRegex(ValueError, 'Missing x64'):
            merge_artifacts(self.source, self.destination)

    def test_truncated_installer_cannot_publish(self):
        self.add_architecture('arm64')
        self.add_architecture('x64')
        installer = next((self.source / 'mac-x64').glob('*.zip'))
        installer.write_bytes(b'broken')
        with self.assertRaisesRegex(ValueError, 'Incorrect asset size'):
            merge_artifacts(self.source, self.destination)


if __name__ == '__main__':
    unittest.main()
