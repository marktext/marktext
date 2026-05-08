# MarkText — macOS Source Build Runbook

Tested: 2026-05-08 on macOS (Apple Silicon, arm64).

## Prerequisites

| Tool | Required Version | Install |
|------|-----------------|---------|
| Homebrew | any | https://brew.sh |
| nvm | any | `brew install nvm` |
| Node.js | >=16, <17 | `nvm install 16` |
| Yarn | 1.x | `brew install yarn` |
| Python | >=3.6, <3.12 (needs `distutils`) | `brew install python@3.11` |

### One-time nvm setup (add to `~/.zshrc` if not already present)

```sh
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && source "/opt/homebrew/opt/nvm/nvm.sh"
```

## Build Steps

```sh
# 1. Switch to the required Node version
nvm use 16

# 2. Clone (skip if you already have the repo)
git clone https://github.com/marktext/marktext.git
cd marktext

# 3. Install dependencies (PYTHON must point to a distutils-compatible interpreter)
PYTHON="/opt/homebrew/bin/python3.11" yarn install

# 4. Build binaries + packages (DMG, ZIP) for your OS
PYTHON="/opt/homebrew/bin/python3.11" yarn run build
```

Build artifacts appear in `build/`:

- `marktext-arm64.dmg` — Apple Silicon installer
- `marktext-x64.dmg` — Intel installer
- `marktext-arm64-mac.zip` / `marktext-x64-mac.zip` — portable ZIPs
- `build/mac-arm64/MarkText.app` / `build/mac/MarkText.app` — raw app bundles

## Verify

```sh
open build/mac-arm64/MarkText.app          # launch (use build/mac/ for Intel)
pgrep -fl '/MarkText.app/Contents/MacOS'   # confirm process is running
```

## Cleanup

```sh
yarn run build:clean   # removes dist/ and build/ intermediates
```

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `ModuleNotFoundError: No module named 'distutils'` | Python ≥3.12 removed `distutils` | Use Python 3.11: `PYTHON=/opt/homebrew/bin/python3.11` |
| `gyp: name 'openssl_fips' is not defined` during `keytar` rebuild | Node ≥18 incompatible with `keytar@7.x` | Use Node 16 via `nvm use 16` |
| Code signing skipped | No Apple Developer ID certificate | Expected for local builds; app still runs |

## Notes

- `dist/` and `build/` are both in `.gitignore` — build output won't pollute the repo.
- The `postinstall` script runs `electron-rebuild` and `lint:fix` automatically during `yarn install`.
