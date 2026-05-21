# Releasing MarkText

The release pipeline is triggered by pushing a `v*` tag. The `Release MarkText` workflow (`.github/workflows/release.yml`) then runs **validate → build (5-platform matrix) → publish** and creates a GitHub Release with installers and `SHA256SUMS.txt`.

The flow below covers both release candidates and stable releases — same steps, only the version string differs.

## Prerequisites

- Push access to `marktext/marktext`
- `gh` CLI authenticated (`gh auth status`)
- A clean checkout of the latest `develop`

## 1. Cut a release branch (first RC only)

```bash
git checkout develop
git pull --ff-only
git checkout -b release/vX.Y.0     # e.g. release/v0.19.0
```

Reuse the same branch for every RC of that minor version (`rc.1`, `rc.2`, …) **and** the eventual stable tag. For follow-ups, just `git checkout release/vX.Y.0` and skip to step 2.

## 2. Bump `package.json`

Edit the `version` field — it is the only file you need to change.

| Stage | Version string |
|---|---|
| Release candidate | `0.19.0-rc.1`, `0.19.0-rc.2`, … |
| Stable | `0.19.0` |

## 3. Commit and push the branch

```bash
git add package.json
git commit -m "chore(release): vX.Y.Z[-rc.N]"
git push -u origin release/vX.Y.0
```

## 4. Tag and push

```bash
git tag -a vX.Y.Z-rc.N -m "vX.Y.Z-rc.N"
git push origin vX.Y.Z-rc.N
```

A `-` in the tag (e.g. `v0.19.0-rc.1`) tells the workflow to mark the GitHub Release as **pre-release** automatically. Plain `vX.Y.Z` tags publish as stable releases.

## 5. Open a tracking PR (RC only)

Open a **draft** PR from `release/vX.Y.0` → `develop` for visibility. Do **not** merge it until the matching stable tag is pushed — merging an RC commit would freeze `develop` at the RC version.

```bash
gh pr create --draft --base develop --head release/vX.Y.0 \
  --title "chore(release): vX.Y.0 release branch (DO NOT MERGE until stable)" \
  --body "Tracking branch for vX.Y.0. Merge after the stable tag is published."
```

## 6. Monitor the workflow

```bash
gh run list --workflow=release.yml --limit 3
gh run watch <run-id> --exit-status
```

Approximate timing: validate ~30 s · build matrix ~15–30 min (5 platforms in parallel) · publish ~1 min.

## 7. Verify the published release

```bash
gh release view vX.Y.Z-rc.N
```

Confirm:

- `Pre-release` badge on the release page (RC only)
- **24 assets**:
  - **Linux** (5): `AppImage`, `deb`, `rpm`, `snap`, `tar.gz`
  - **macOS arm64** (4): `dmg`, `dmg.blockmap`, `zip`, `zip.blockmap`
  - **macOS x64** (4): `dmg`, `dmg.blockmap`, `zip`, `zip.blockmap`
  - **Windows x64** (3): `setup.exe`, `setup.exe.blockmap`, `zip`
  - **Windows arm64** (3): `setup.exe`, `setup.exe.blockmap`, `zip`
  - **Auto-updater metadata** (4): `latest.yml`, `latest-mac.yml`, `latest-linux.yml`, `builder-debug.yml`
  - **Checksums** (1): `SHA256SUMS.txt`
- Auto-generated release notes list the PRs merged since the previous tag

## 8. Post-stable cleanup (after stable `vX.Y.0` ships)

1. Mark the tracking PR from step 5 ready for review and merge into `develop`
2. Open a follow-up PR bumping `develop`'s `package.json` to the next dev version (e.g. `0.20.0-dev`)

## Homebrew on Linux

The Homebrew on Linux formula in [`packaging/homebrew/marktext.rb`](https://github.com/marktext/marktext/blob/develop/packaging/homebrew/marktext.rb) is an experimental template for a future custom tap. It should not be published until a tagged release includes a Linux `tar.gz` artifact.

After publishing a release:

1. Confirm the release contains `marktext-linux-<version>.tar.gz`.
2. Update `packaging/homebrew/marktext.rb` with the release URL and SHA256.
3. Copy `marktext.rb` into the tap's `Formula/` directory.
4. Run:

   ```bash
   brew style packaging/homebrew/marktext.rb
   brew audit --strict --online <tap>/marktext
   brew install <tap>/marktext
   brew test <tap>/marktext
   ```

Keep this separate from the existing `mark-text` Homebrew cask, which is macOS-only.

---

For hotfixes off a previously-released tag, see [RELEASE_HOTFIX.md](RELEASE_HOTFIX.md). Once the hotfix branch is ready, steps 2–7 above apply.
