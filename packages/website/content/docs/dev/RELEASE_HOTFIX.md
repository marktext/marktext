# Prepare a Hotfix

Start from the published tag that needs the fix, rather than from a development branch that may include unreleased features.

```sh
git fetch origin --tags
git switch -c hotfix/vX.Y.Z vX.Y.P
```

Replace `vX.Y.P` with the affected release tag and `vX.Y.Z` with the intended patch version.

Apply the fix directly or cherry-pick the relevant commit:

```sh
git cherry-pick <commit>
```

Resolve any conflicts and run the relevant checks and platform builds. Follow [Releasing MarkText](RELEASE.md) to update both application package versions, record release highlights, commit, tag and verify the published artifacts. The tag triggers public publication once the release workflow succeeds.

Bring applicable fixes back to `develop` through a PR so later releases retain them.
