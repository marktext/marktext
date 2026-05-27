# Feature Registry — MarkText

> Complete decomposition of MarkText into logical feature units.
> Each entry links to a detailed feature file.

---

## Safety Levels

| Level | Meaning |
|-------|---------|
| `SAFE` | Low coupling, well-tested, no process boundary cross |
| `CAUTION` | Medium coupling or IPC involvement; spec + analysis required |
| `HIGH RISK` | Core engine, cross-process, or cascade-prone; spec + human review |
| `LOCKED` | Do not modify; requires release engineering sign-off |

---

## Feature Registry

| ID | Feature | Safety Level | Feature File | Primary Process |
|----|---------|-------------|-------------|-----------------|
| F01 | WYSIWYG Editor Core (Muya ContentState) | HIGH RISK | `features/editor-core.md` | muya |
| F02 | Markdown Parser (Inline + Block) | HIGH RISK | `features/markdown-parser.md` | muya |
| F03 | IPC Bridge Contract | HIGH RISK | `features/ipc-bridge.md` | preload + main |
| F04 | Preferences System | CAUTION | `features/preferences-system.md` | main + renderer |
| F05 | File System Operations | CAUTION | `features/file-system.md` | main |
| F06 | Window Management | CAUTION | `features/window-management.md` | main |
| F07 | Theme System | SAFE | `features/theme-system.md` | renderer + muya |
| F08 | Spell Checker | CAUTION | `features/spell-checker.md` | main + renderer |
| F09 | Keyboard Shortcuts | CAUTION | `features/keyboard-shortcuts.md` | main + renderer |
| F10 | Search (Full-Text via ripgrep) | CAUTION | `features/search.md` | main |
| F11 | Export (Markdown/HTML/PDF) | CAUTION | `features/export.md` | muya + renderer |
| F12 | Image Handling | CAUTION | `features/image-handling.md` | main + renderer |
| F13 | Source Code Mode (CodeMirror) | SAFE | `features/source-code-mode.md` | renderer |
| F14 | Command Palette | SAFE | `features/command-palette.md` | renderer |
| F15 | Sidebar / File Tree | SAFE | `features/sidebar.md` | renderer + main |
| F16 | Auto-Save & Buffer Recovery | CAUTION | `features/auto-save.md` | main + renderer |
| F17 | i18n / Localization | SAFE | `features/i18n.md` | common + main + renderer |
| F18 | Auto-Updater | LOCKED | _(no feature file — locked)_ | main |
| F19 | Table Editing | CAUTION | `features/table-editing.md` | muya |
| F20 | Math (KaTeX) | SAFE | `features/math-katex.md` | muya |
| F21 | Mermaid Diagrams | SAFE | `features/mermaid.md` | muya |
| F22 | PlantUML | CAUTION | `features/plantuml.md` | muya (uses Node zlib) |
| F23 | Focus / Typewriter Mode | SAFE | `features/focus-typewriter.md` | renderer + muya |
| F24 | Frontmatter Support | CAUTION | `features/frontmatter.md` | muya + renderer |
| F25 | Context Menus | SAFE | `features/context-menus.md` | main + renderer |

---

## Notes

- `PARTIAL` features (insufficient code evidence to fully characterize):
  - F18 Auto-Updater: code exists in `src/main/` but locked from AI modification.
  - F22 PlantUML: only partially characterized; depends on external network call + zlib.

- Features marked `LOCKED` have no feature file because modification is prohibited.

---

## Feature Coverage by Test

| Feature ID | Unit Tests | E2E Tests | Coverage |
|------------|-----------|-----------|----------|
| F01 | `test/unit/specs/markdown-basic.spec.js` + others | `test/e2e/` | PARTIAL |
| F02 | `test/unit/specs/` (multiple) | None confirmed | PARTIAL |
| F04 | None confirmed | None confirmed | MISSING |
| F05 | None confirmed | None confirmed | MISSING |
| F13 | None confirmed | None confirmed | MISSING |

> Missing test coverage is an AI Maintainability Gap. See Repository Analysis for details.
