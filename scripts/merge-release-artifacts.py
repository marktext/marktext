import argparse
import shutil
from pathlib import Path

import yaml


def merge_artifacts(source: Path, destination: Path):
    destination.mkdir(parents=True, exist_ok=True)
    metadata = {}
    for artifact in sorted(source.iterdir()):
        if not artifact.is_dir():
            continue
        for file in sorted(artifact.iterdir()):
            if file.name.startswith('latest') and file.suffix == '.yml':
                metadata.setdefault(file.name, []).append(yaml.safe_load(file.read_text()))
                continue
            target = destination / file.name
            if target.exists():
                # Each builder emits platform-specific diagnostics under the same name.
                if file.name == 'builder-debug.yml':
                    continue
                raise ValueError(f'Duplicate release asset: {file.name}')
            shutil.copy2(file, target)

    for name, documents in metadata.items():
        if len({document['version'] for document in documents}) != 1:
            raise ValueError(f'Conflicting versions in {name}')
        files = {}
        for document in documents:
            for file in document['files']:
                url = file['url']
                if url in files and files[url] != file:
                    raise ValueError(f'Conflicting metadata for {url}')
                if Path(url).name != url or not (destination / url).is_file():
                    raise ValueError(f'Missing release asset: {url}')
                if (destination / url).stat().st_size != file['size']:
                    raise ValueError(f'Incorrect asset size: {url}')
                files[url] = file
        if name in {'latest.yml', 'latest-mac.yml'}:
            for arch in ['arm64', 'x64']:
                if not any(f'-{arch}-' in url for url in files):
                    raise ValueError(f'Missing {arch} update metadata in {name}')
        # Older updaters read the top-level path; retain the x64 fallback.
        merged = dict(next((doc for doc in documents if '-x64-' in doc.get('path', '')), documents[0]))
        merged['files'] = [files[url] for url in sorted(files)]
        merged['releaseDate'] = max(doc['releaseDate'] for doc in documents)
        (destination / name).write_text(yaml.safe_dump(merged, sort_keys=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    merge_artifacts(args.source, args.destination)
