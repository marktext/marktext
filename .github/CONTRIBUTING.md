### Mark Text Contributing Guide

Hi, I'm really excited that you are interested in contributing to Mark Text. Before submitting your contribution though, please make sure to take a moment and read through the following guidelines.

- [Code of Conduct](https://github.com/marktext/marktext/blob/master/.github/CODE_OF_CONDUCT.md)

- Issue Reporting Guidelines

- Pull Request Guidelines

### Issue Reporting Guidelines

Always follow the [**Issue** template](https://github.com/marktext/marktext/blob/master/.github/ISSUE_TEMPLATE.md)

### Pull Request Guidelines

- Submit the PRs directly to the `master` branch.

- Work in the `src` folder and **DO NOT** checkin `dist` in commits.

- If you adding new feature:

  - Open a suggestion issue first and add appropriate label to it.

  - Provide convincing reason to add this feature.

  - Then submit you PRs.

- If fixing a bug:

  - you are resolving a special issue, add`(fix #xxxx[,#xxx])`(#xxxx is the issue id) in your PR title for a better release log, e.g.`update entities encoding/decoding (fix #3899)`.

  - Provide detailed description of the bug in the PR. Live demo or picture preferred.

- All PRs need to pass the **Travis Ci** before merged.
