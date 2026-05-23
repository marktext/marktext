# Releasing MarkText

The release pipeline is driven entirely by tag pushes. Pushing a valid `v*` tag triggers the `Release MarkText` workflow (`.github/workflows/release.yml`), which runs **validate → build (4-platform matrix) → publish** and creates a GitHub Release with installers and a `SHA256SUMS.txt`.

This guide covers both release candidates and stable releases — the path is the same; only the version string differs.

## Prerequisites

- Push access to `marktext/marktext` (you need to push branches and tags directly to `origin`)
- `gh` CLI authenticated (`gh auth status` to confirm)
- Clean checkout of the latest `develop`

## 1. Cut a release branch (first RC only)

Branch from the `develop` tip. The same branch is reused for all subsequent RCs *and* the stable tag of that minor version.

```bash
git checkout develop
git pull --ff-only
git checkout -b release/vX.Y.0     # e.g. release/v0.19.0
```

For any follow-up RC (`rc.2`, `rc.3`, …) or the eventual stable release, just `git checkout release/vX.Y.0` and skip to step 2.

## 2. Bump `package.json`

Edit the `version` field. This is the **only** file that needs editing — `app.getVersion()` and `electron-builder` both read it.

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

Tag rules enforced by the `validate` job:

- Must match `^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$`
- A `-` in the tag (e.g. `v0.19.0-rc.1`) makes the GitHub Release **automatically a pre-release**. Tags without `-` (e.g. `v0.19.0`) publish as a normal release.

## 5. Open a tracking PR (RC only)

Open a **draft** PR from `release/vX.Y.0` → `develop` for visibility. Do **not** merge it until the stable tag of the same minor version is pushed — merging an RC commit would freeze `develop` at the RC version.

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

Approximate timings: `validate` ~30 s · `build` matrix ~15–30 min (4 platforms run in parallel) · `publish` ~1 min.

## 7. Verify the published release

```bash
gh release view vX.Y.Z-rc.N
```

Confirm:

- `Pre-release` label on the release page (RC only) — should be auto-set from the `-` in the tag
- **12 assets**: 5 Linux (`AppImage`, `deb`, `rpm`, `snap`, `tar.gz`) + 4 macOS (`arm64.dmg`, `arm64.zip`, `x64.dmg`, `x64.zip`) + 2 Windows (`setup.exe`, `zip`) + `SHA256SUMS.txt`
- Auto-generated release notes list the PRs merged since the previous tag
- The boilerplate body (pre-release warning if applicable, macOS `xattr -cr` instructions, SHA-256 verification snippet) is present

## 8. Post-stable cleanup (after stable `vX.Y.0` ships)

Once the stable release is shipped and binaries pass smoke testing:

1. Mark the tracking PR (from step 5) as ready for review and merge it into `develop`
2. Open a follow-up PR bumping `develop` `package.json` to the next dev version (e.g. `0.20.0-dev`)

---

## Troubleshooting

### `validate` rejects the tag

The tag doesn't match the semver regex. Common causes: typo (`v.0.19.0`), missing `v` prefix, invalid prerelease characters. Delete and retag:

```bash
git push origin :refs/tags/<bad-tag>   # remote delete
git tag -d <bad-tag>                   # local delete
git tag -a <good-tag> -m "<good-tag>"
git push origin <good-tag>
```

### A single platform's `build` job fails

The artifacts from the three healthy platforms are kept on the run for 7 days. Fix the underlying issue on the release branch, then either:

- Re-run only the failed job (artifacts of healthy platforms are reused):
  ```bash
  gh run rerun <run-id> --failed
  ```
- If the fix needs a new commit on the release branch, bump to the next RC (`-rc.N+1`) and tag again. The previous failed run can be left alone — the new tag triggers a fresh run.

### `publish` reports `Bad credentials`

Seen in practice during `v0.19.0-rc.1`: the default `GITHUB_TOKEN` occasionally fails to issue for the publish step even though `permissions: contents: write` is declared correctly. It is transient.

```bash
gh run rerun <run-id> --failed
```

Only the ~1-minute publish step re-runs; build artifacts are reused. If it fails twice in a row, inspect repo **Settings → Actions → General → Workflow permissions** — it must allow read/write or honor per-job `permissions:` blocks.

### Manual fallback (workflow stuck, artifacts in hand)

If automation is hopelessly stuck but the build artifacts from a partially-failed run are still available:

```bash
gh run download <run-id> --dir dist
cd dist
LC_ALL=C find . -maxdepth 1 -type f ! -name 'SHA256SUMS.txt' -printf '%f\n' \
  | sort | xargs -I{} sha256sum "{}" > SHA256SUMS.txt
gh release create vX.Y.Z-rc.N \
  --prerelease --generate-notes \
  --title vX.Y.Z-rc.N \
  ./*
```

Drop `--prerelease` for stable releases.

---

For hotfixes off a previously-released tag, see [RELEASE_HOTFIX.md](RELEASE_HOTFIX.md). Once a hotfix branch is ready, the steps above (from §2 onward) apply.
