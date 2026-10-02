# MarkText Contributing Guide

Thank you very much for your interest in contributing to MarkText. Before submitting your contribution, please take a moment to read the following guidelines.

## Philosophy

Our philosophy is to keep things clean, clear, and minimal.

MarkText is constantly evolving, and we want these improvements to stay aligned with this philosophy. For example, the sidebar and tabs provide useful functionality without distracting users, while keeping the default interface clean and minimal. In the future, we hope to expand MarkText's capabilities through a plugin system.

## The One Rule

**You must understand the code you submit.** If you cannot explain what your changes do and how they interact with the rest of the system, your PR will be closed.

Using AI to write code is fine. Submitting AI-generated code that you do not understand is not.

If you use an agent, run it from the MarkText root directory so that it can automatically pick up `AGENTS.md`. Your agent must follow the rules and guidelines in that file.

## Issue and PR Guidelines

Before opening an Issue or PR, please search for similar Issues and PRs first. Always follow the [Issue template](./ISSUE_TEMPLATE/) and [PR template](./PULL_REQUEST_TEMPLATE.md) when submitting them.

Issues and PRs should follow the single-purpose principle: **one Issue should address one problem, and one PR should fix one issue or a set of closely related changes.** Do not submit multiple unrelated problems in a single Issue or multiple unrelated fixes in a single PR.

Issues and PRs that do not follow these requirements may be closed without further review.

All PRs must provide a detailed description of the problem and demonstrate the issue or the changes with screen recordings and/or screenshots.

When submitting a PR, please keep the following in mind:

- Submit PRs directly to the `develop` branch.
- Reference the related Issue in the PR description.
- Follow our [Commenting Guidelines](./COMMENTING-GUIDELINES.md).
- Ensure all tests pass.
- Run `pnpm run lint` to lint your PR.
- All PRs must pass **CI** before they can be merged. If CI fails, please try to resolve the issue. If you need help, feel free to ask.

If you are adding a new feature:

- Open a feature request Issue first.
- Explain why you want to add the feature, and confirm the final solution with MarkText members before submitting a PR.

If you are fixing a bug:

- If you are fixing a specific Issue, include `fix: #<issue number> <short message>` in the PR title. For example: `fix: #3899 update entities encoding/decoding`.
- Provide a detailed description of the cause of the bug in the PR and/or reference the related Issue.

## Where Should I Start?

A good way to get started is to look for Issues labeled `bug`, `help wanted`, or `feature request` in the [Issue tracker](https://github.com/marktext/marktext/issues). Issues labeled `good first issue` are especially suitable for newcomers.

For larger Issues, please discuss the proposed solution first. Once the final solution has been approved by MarkText members, you can submit or start working on a PR. For smaller changes, you can open a PR directly.

There are also other ways you can help MarkText:

- Improve the documentation
- Translate MarkText (currently unavailable)
- Design icons and logos
- Improve the UI
- Write tests for MarkText
- Share your thoughts! We want to hear about features you think MarkText is missing, bugs you find, and why you ❤️ MarkText.

## Developer Documentation

For more details, please [visit the developer documentation](https://marktext.me/docs/dev/overview).
