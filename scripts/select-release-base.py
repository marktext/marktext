import json
import re
import sys


def select_release_base(tag: str, releases: list[dict]) -> str:
    match = re.fullmatch(r'v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:[-+].+)?', tag)
    if not match:
        raise ValueError(f'Invalid release tag: {tag}')
    current = tuple(map(int, match.groups()))
    candidates = []
    for release in releases:
        if release['draft'] or release['prerelease']:
            continue
        previous = re.fullmatch(r'v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', release['tag_name'])
        if previous:
            version = tuple(map(int, previous.groups()))
            if version < current:
                candidates.append((version, release['tag_name']))
    if not candidates:
        raise ValueError(f'No published stable release precedes {tag}')
    return max(candidates)[1]


if __name__ == '__main__':
    pages = json.load(sys.stdin)
    print(select_release_base(sys.argv[1], [release for page in pages for release in page]))
