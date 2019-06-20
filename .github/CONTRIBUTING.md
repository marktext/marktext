# Mark Text Contributing Guide

We are really excited that you are interested in contributing to Mark Text :tada:. Before submitting your contribution though, please make sure to take a moment and read through the following guidelines.

- [Code of Conduct](https://github.com/marktext/marktext/blob/master/.github/CODE_OF_CONDUCT.md)
- [Issue Reporting Guidelines](#issue-reporting-guidelines)
- [Pull Request Guidelines](#pull-request-guidelines)
  - [Where should I start?](#where-should-i-start)
- [Quick Start](#quick-start)
  - [Build Instructions](#build-instructions)
  - [Style guide](#style-guide)
- [Project Structure](#project-structure)

## Issue Reporting Guidelines

Please search for similar issues before opening an issue and always follow the [issue template](https://github.com/marktext/marktext/blob/master/.github/ISSUE_TEMPLATE.md). Please provide a detailed description of the problem in your PR and live demo or screenshots are preferred.

## Pull Request Guidelines

- Submit PRs directly to the `develop` branch.

- Work in the `src` folder and **DO NOT** checkin `dist` in commits.

- If you adding new feature:

  - Open a suggestion issue first.
  - Provide convincing reason to add this feature.
  - Then submit your PR.

- If fixing a bug:

  - If you are resolving a special issue, add `fix: #xxx[,#xxx]` (`#xxx` is the issue id) in your PR title for a better release log, e.g.`fix: #3899 update entities encoding/decoding`.
  - Update `.github/CHANGELOG.md` for notable changes - like bug fixes and features.
  - Provide detailed description of the bug in your PR and/or link to the issue. You can also include screenshots.

- Please lint and test your PR before submitting.

- All PRs need to pass the **Travis CI** before merged. If it fails, please try to solve the issue(s) and feel free to ask for any help.

### Where should I start?

Find a issue flagged as a `bug`, `help wanted` or `enhancement `. The `good first issue` issues are good for new comers. Discuss the solution in the issue and after the final solution is approved by the Mark Text members, you can submit/work on the PR. For small fixes, you can directly open a PR.

Other ways to help:

- Documentation (*1)
- Translation (*1)
- Help to answer `more detail` issues or discuss changes and features.
- Report bugs and feature ideas.

***1**: More or less blocked until v1.0 release because of early development phase.

## Quick Start

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

### Build Instructions

**Prerequisites:**

Before you can get started developing, you need set up your build environment:

- Node.js `>=v10.16.0`, npm and yarn
- Python `v2.7.x` for node-gyp
- C++ compiler and development tools

**Additional development dependencies on Linux:**

- libx11 (dev)
- libxkbfile (dev)
- libsecret (dev)

On Debian-based Linux: `sudo apt-get install libx11-dev libxkbfile-dev libsecret-1-dev`

On Red Hat-based Linux: `sudo dnf install libx11-devel libxkbfile-devel libsecret-devel`

**Let's build:**

1. Go to `marktext` folder
2. Install dependencies: `yarn install` or `yarn install --frozen-lockfile`
3. Build Mark Text: `npm run build`
4. Mark Text binary is located under `build` folder

Copy the build app to applications folder, or if on Windows run the executable installer.

**Important scripts:**

```
$ npm run <script> # or yarn run <script>
```

| Script          | Description                               |
| --------------- | ----------------------------------------- |
| `build`         | Build Mark Text binaries for your OS      |
| `dev`           | Build and run Mark Text in developer mode |
| `lint`          | Lint code style                           |
| `test` / `unit` | Run unit tests                            |

For more scripts please see `package.json`.

### Style guide

- ES6 and "best practices"
- 2 space indent
- no semicolons
- JSDoc for documentation

## Project Structure

- `.`: Configuration files
- `package.json`: Project settings
- `build/`: Contains generated binaries
- `dist/`: Build files for deployment
- `docs/`: Documentation and assets
- `resources/`: Application assets using at build time
- `node_modules/`: Dependencies
- `src`: Mark Text source code
  - `common/`: Common source files that only require Node.js APIs. Code from this folder can be used in all other folders except `muya`.
  - `main/`: Main process source files that require Electron main-process APIs. `main` files can use `common` source code.
  - `muya/`: Mark Texts backend that only allow pure JavaScript, BOM and DOM APIs. Don't use Electron or Node.js APIs!
  - `renderer`: Fontend that require Electron renderer-process APIs and may use `common` or `muya` source code.
- `static/`: Application assets (images, themes, etc)
- `test/`: Contains (unit) tests
