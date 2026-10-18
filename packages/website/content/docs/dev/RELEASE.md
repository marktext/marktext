# Releasing MarkText

The release pipeline is triggered by pushing a `v*` tag. The `Release MarkText` workflow (`.github/workflows/release.yml`) then runs **validate → build (6-platform matrix) → publish** and creates a GitHub Release with installers and `SHA256SUMS.txt`.

Release notes explicitly compare against the highest published stable `vX.Y.Z` version below the new version, selected from all release pages by `scripts/select-release-base.py`. Drafts, prereleases, and the current version are excluded. RCs compare against the previous stable cycle; hotfixes exclude newer versions. For example, `v0.22.0` compares against `v0.21.2` even if that tag is on a separate release branch. The workflow fails if no earlier stable release exists instead of falling back to GitHub's automatic comparison base. Verify the `Full Changelog` link during release review.

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

## 2. Bump the application version

Set the same `version` in the root `package.json` and `packages/desktop/package.json`. The desktop package determines the installer and application version. Muya and the website keep their independent package versions.

Update `packages/website/content/docs/CHANGELOG.md` with the release highlights. Check lockfile consistency with `pnpm install --lockfile-only --ignore-scripts`, then run lint, typecheck, unit tests, build, and relevant E2E tests before pushing the release tag.

| Stage             | Version string                  |
| ----------------- | ------------------------------- |
| Release candidate | `0.19.0-rc.1`, `0.19.0-rc.2`, … |
| Stable            | `0.19.0`                        |

## 3. Commit and push the branch

```bash
git add package.json packages/desktop/package.json packages/website/content/docs/CHANGELOG.md
git commit -m "chore(release): vX.Y.Z[-rc.N]"
git push -u origin release/vX.Y.0
```

## 4. Tag and push

A tag push automatically publishes a public release after all builds succeed; it does not stop at a draft. Confirm the release commit and required CI checks before pushing.

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

Approximate timing: validate ~30 s · build matrix ~15–30 min (6 platforms in parallel) · publish ~1 min.

## 7. Verify the published release

```bash
gh release view vX.Y.Z-rc.N
```

Confirm:

- `Pre-release` badge on the release page (RC only)
- **29 assets**:
  - **Linux x64** (5): `AppImage`, `deb`, `rpm`, `snap`, `tar.gz`
  - **Linux arm64** (4): `AppImage`, `deb`, `rpm`, `tar.gz`
  - **macOS arm64** (4): `dmg`, `dmg.blockmap`, `zip`, `zip.blockmap`
  - **macOS x64** (4): `dmg`, `dmg.blockmap`, `zip`, `zip.blockmap`
  - **Windows x64** (3): `setup.exe`, `setup.exe.blockmap`, `zip`
  - **Windows arm64** (3): `setup.exe`, `setup.exe.blockmap`, `zip`
  - **Auto-updater metadata** (5): `latest.yml`, `latest-mac.yml`, `latest-linux.yml`, `latest-linux-arm64.yml`, `builder-debug.yml`
  - **Checksums** (1): `SHA256SUMS.txt`
- Auto-generated release notes list the PRs merged since the previous tag

## 8. Post-stable cleanup (after stable `vX.Y.0` ships)

1. Mark the tracking PR from step 5 ready for review and merge into `develop`
2. Open a follow-up PR bumping `develop`'s root and desktop `package.json` files to the next dev version (e.g. `0.20.0-dev`)

---

For hotfixes off a previously-released tag, see [RELEASE_HOTFIX.md](RELEASE_HOTFIX.md). Once the hotfix branch is ready, steps 2–7 above apply.
