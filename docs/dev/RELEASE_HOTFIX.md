# Prepare a hotfix

- Create a hotfix branch: `git checkout -b hotfix-vX.Y.Z`
- Make changes to the code and/or `cherry-pick` changes from another branch and commit changes.
- Test the hotfix and binaries.
- [Release](RELEASE.md) a new MarkText version.

**How to cherry pick?**

You can pick commits from another branch and apply the commit to the current one.

- `git checkout hotfix-vX.Y.Z`
- `git cherry-pick <full commit hash>`
- Please resolve all conflicts and `git commit` the changes if needed.
