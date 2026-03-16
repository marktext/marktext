# Repository Guidelines

## Project Structure & Module Organization
MarkText is an Electron app with a split runtime under `src/`:

- `src/main/`: Electron main-process code for windows, IPC, and OS integration.
- `src/renderer/`: Vue 2 renderer UI, store modules, and editor-facing commands.
- `src/common/`: shared Node-safe utilities used across main and renderer.
- `src/muya/`: the editor core; keep it free of Electron and Node.js APIs.
- `static/` and `resources/`: bundled assets and build-time resources.
- `test/unit/`, `test/e2e/`, `test/specs/`: Karma unit tests, Playwright end-to-end tests, and Markdown spec runners.
- `docs/dev/`: build, architecture, debugging, and release notes.

## Build, Test, and Development Commands
Use Yarn with Node `>=16 <17`.

- `yarn install --frozen-lockfile`: install dependencies reproducibly.
- `yarn dev`: run the Electron app in developer mode.
- `yarn build`: create production packages for the current OS.
- `yarn build:bin`: build unpacked binaries only.
- `yarn lint` / `yarn lint:fix`: check or autofix ESLint issues in `src` and `test`.
- `yarn unit`: run Karma + Mocha/Chai unit tests.
- `yarn e2e`: package the app, then run Playwright tests from `test/e2e`.
- `yarn test:specs`: run CommonMark and GFM spec validation scripts.

## Coding Style & Naming Conventions
Follow `.editorconfig` and ESLint Standard/Vue rules:

- 2-space indentation, UTF-8, LF line endings, trailing newline.
- No semicolons.
- Prefer ES modules and existing alias imports such as `@`, `common`, and `muya`.
- Match existing naming: Vue components in PascalCase, utility modules in kebab-case or lower camel case, tests ending in `.spec.js`.
- Add JSDoc where behavior or public APIs are not obvious.

## Testing Guidelines
Put unit coverage in `test/unit/specs/` and e2e coverage in `test/e2e/`. Follow existing names like `markdown-basic.spec.js` and `launch.spec.js`. Run `yarn lint`, `yarn unit`, and the relevant `yarn e2e` or `yarn test:specs` path before opening a PR.

## Commit & Pull Request Guidelines
Recent history uses short, imperative subjects with prefixes such as `fix:`, `chore:`, and scoped tags like `[i18n]`. Keep commits focused and reference the issue when applicable. Open PRs against `develop`, link the issue, describe the behavioral change, and include screenshots or recordings for UI work. Ensure CI passes before requesting review.
