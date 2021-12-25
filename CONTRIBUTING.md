# MarkText Contributing Guide

We are really excited that you are interested in contributing to MarkText :tada:. Before submitting your contribution though, please make sure to take a moment and read through the following guidelines.

- [Code of Conduct](.github/CODE_OF_CONDUCT.md)
- [Philosophy](#philosophy)
- [Issue reporting guidelines](#issue-reporting-guidelines)
- [Pull request guidelines](#pull-request-guidelines)
  - [Where should I start?](#where-should-i-start)
- [Quick start](#quick-start)
  - [Build instructions](#build-instructions)
  - [Style guide](#style-guide)
- [Developer documentation](#developer-documentation)

## Philosophy

MarkText is still in development, many things will change and feature will be added but our philosophy is to keep things clean, simple and minimal. For example our side bar and tabs: these two panels provide a lot of functionality but don't disturb the user if it's need it. We'll add more and more feature, maybe extended by plugins, that can be activated via settings to improve MarkText. So we allow everyone to customize MarkText for it needs and provide a minimal default interface.

## Issue reporting guidelines

Please search for similar issues before opening an issue and always follow the [issue template](.github/ISSUE_TEMPLATE.md). Please provide a detailed description of the problem in your PR and live demo or screenshots are preferred.

## Pull request guidelines

Please make sure the following is done before submitting a PR:

- Submit PRs directly to the `develop` branch.
- Reference the related issue in the PR comment.
- Utilize JSDoc for better code documentation.
- Ensure all tests passes.
- Please lint (`yarn run lint`) and test your PR before submitting.
- All PRs need to pass the **CI** before merged. If it fails, please try to solve the issue(s) and feel free to ask for any help.

If you add new feature:

- Open a suggestion issue first.
- Provide convincing reason to add this feature.
- Then submit your PR.

If fix a bug:

- If you are resolving a special issue, please add `fix: #<issue number> <short message>` in your PR title (e.g.`fix: #3899 update entities encoding/decoding`).
- Provide detailed description of the bug in your PR and/or link to the issue. You can also include screenshots.

### Where should I start?

A good way to start to find an issue flagged as a `bug`, `help wanted` or `feature request`. The `good first issue` issues are good for newcomers. Please discuss the solution for larger issues first and after the final solution is approved by the MarkText members, you can submit/work on the PR. For small changes you can directly open a PR.

Other ways to help:

- Documentation
- Translation (currently unavailable)
- Design icons and logos and improve the UI
- Help to test MarkText
- Help to answer issues or discuss changes and features.
- Let us know you opinion about MarkText, missing features and report bugs and problems. :+1: features you like and discuss with us about upcoming changes and features.

## Quick start

1. Fork the repository.
2. Clone your fork: `git clone git@github.com:<username>/marktext.git`
3. Create a feature branch: `git checkout -b feature`
4. Make you changes and push your branch.
5. Create a PR against `develop` and describe your changes.

**Rebase your PR:**

If there are conflicts or you want to update your local branch, please do the following:

1. `git fetch upstream`
2. `git rebase upstream/develop`
3. Please [resolve](https://help.github.com/articles/resolving-merge-conflicts-after-a-git-rebase/) all conflicts and force push your feature branch: `git push -f`

### Build instructions

Please see [here](docs/dev/BUILD.md) for build instructions.

### Style guide

You can run ESLint (`yarn run lint`) to help you to follow the style guide.

- ES6 and "best practices"
- 2 space indent
- no semicolons
- JSDoc for documentation

## Developer documentation

Please see [here](docs/dev/README.md) for more details.
