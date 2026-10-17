import argparse
import base64
import hashlib
import shutil
from pathlib import Path

import yaml


def merge_artifacts(source: Path, destination: Path, version: str) -> None:
    manifests = {}
    for name, count in [
        ('latest.yml', 2),
        ('latest-mac.yml', 2),
        ('latest-linux.yml', 1),
        ('latest-linux-arm64.yml', 1),
    ]:
        documents = [yaml.safe_load(path.read_text()) for path in sorted(source.glob(f'*/{name}'))]
        if len(documents) != count:
            raise ValueError(f'{name}: expected {count} architecture manifests')
        if any(document['version'] != version for document in documents):
            raise ValueError(f'{name}: version does not match release {version}')
        manifests[name] = documents

    destination.mkdir(parents=True, exist_ok=True)
    for file in sorted(source.glob('*/*')):
        if file.name in manifests:
            continue
        target = destination / file.name
        if target.exists():
            # Each builder emits platform-specific diagnostics under the same name.
            if file.name == 'builder-debug.yml':
                continue
            raise ValueError(f'Duplicate release asset: {file.name}')
        shutil.copy2(file, target)

    for name, documents in manifests.items():
        files = sorted(
            (file for document in documents for file in document['files']),
            key=lambda file: file['url'],
        )
        by_url = {file['url']: file for file in files}
        if len(by_url) != len(files):
            raise ValueError(f'{name}: duplicate assets')
        if len(documents) == 2:
            for arch in ['arm64', 'x64']:
                if not any(f'-{arch}-' in url for url in by_url):
                    raise ValueError(f'{name}: missing {arch}')
        for file in files:
            path = destination / file['url']
            if (
                Path(file['url']).name != file['url']
                or not path.is_file()
                or path.stat().st_size != file['size']
            ):
                raise ValueError(f'{name}: missing or truncated asset {file["url"]}')
            with path.open('rb') as stream:
                digest = base64.b64encode(hashlib.file_digest(stream, 'sha512').digest()).decode()
            if digest != file['sha512']:
                raise ValueError(f'{name}: incorrect checksum for {file["url"]}')

        # Older updaters use the top-level path rather than the files list.
        fallback = documents[0]
        if len(documents) == 2:
            fallback = next(
                (document for document in documents if '-x64-' in document.get('path', '')),
                None,
            )
        if fallback is None:
            raise ValueError(f'{name}: missing legacy x64 fallback')
        entry = by_url.get(fallback.get('path'))
        if entry is None or fallback.get('sha512') != entry['sha512']:
            raise ValueError(f'{name}: legacy path/checksum does not match a verified file')
        merged = dict(fallback)
        merged['files'] = files
        merged['releaseDate'] = max(document['releaseDate'] for document in documents)
        (destination / name).write_text(yaml.safe_dump(merged, sort_keys=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('version')
    args = parser.parse_args()
    merge_artifacts(args.source, args.destination, args.version)
