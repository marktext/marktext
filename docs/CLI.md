# Command line interface

```
marktext [options] [path ...]
```

| Option | Description |
|---|---|
| `--debug` | Enable debug mode |
| `--safe` | Disable plugins and other user configuration |
| `-n`, `--new-window` | Open a new window on second-instance |
| `--read-only` | Open the specified files in read-only mode |
| `--user-data-dir <dir>` | Change the user data directory |
| `--disable-gpu` | Disable GPU hardware acceleration |
| `--disable-spellcheck` | Disable built-in spellchecker |
| `-v`, `--verbose` | Be verbose |
| `--version` | Print version information |
| `-h`, `--help` | Print the help message |

## Headless conversion

```
marktext --export-pdf  <in.md...>       [-o <out.pdf|dir>]  [export options]
marktext --export-html <in.md...>       [-o <out.html|dir>] [export options]
marktext --export <fmt> <in.md...>      [-o <out|dir>]
marktext --import <file...>             [-o <out.md|dir>]
```

Converts documents without showing a window and exits when done.

- `--export-pdf` / `--export-html` use the same rendering pipeline as
  **File → Export** (styled HTML, KaTeX, mermaid, CJK text, PDF outline from
  headings) in a hidden window.
- `--export <fmt>` converts Markdown with pandoc; `<fmt>` is one of `docx`,
  `odt`, `rtf`, `epub`, `latex`, `rst`, `org`, `mediawiki`, `textile`.
- `--import` converts a document (docx, odt, epub, …) to Markdown with
  pandoc. Pandoc jobs create no window at all.
- Batch mode: pass several input files; they are converted one after another
  in a single process.
- `-o`, `--output` names the output file for a single input, or the output
  directory for a batch. It defaults to each input's name with the new
  extension.
- Prints every written file to stdout on success.

### Export options (`--export-pdf` / `--export-html`)

Defaults mirror the export dialog: A4 portrait, 20 mm top/bottom and
15 mm left/right margins, default theme, no header/footer.

| Option | Description |
|---|---|
| `--page-size <size>` | `A3`, `A4`, `A5`, `Legal`, `Letter`, `Tabloid` (PDF only) |
| `--landscape` | Landscape orientation (PDF only) |
| `--margin-top <mm>` / `--margin-right <mm>` / `--margin-bottom <mm>` / `--margin-left <mm>` | Page margins, 0–100 mm (PDF only) |
| `--theme <name>` | Export theme: `academic`, `liber` or a CSS file in `<userData>/themes/export` |
| `--header <text>` / `--footer <text>` | Centered page header/footer (PDF only) |
| `--font-family <name>` | Override the export font |
| `--font-size <px>` | Override the export font size (6–72) |
| `--line-height <n>` | Override the export line height (1–3) |
| `--auto-numbering-headings` | Number the headings |
| `--show-front-matter` | Keep the YAML front matter |
| `--toc-title <text>` | Table-of-contents title |

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Conversion succeeded |
| `1` | Conversion failed (renderer error, pandoc error or timeout) |
| `2` | Invalid command line (unknown format, input file not found, …) |

### Notes

- Window jobs (`--export-pdf` / `--export-html`) run against your normal
  user data (theme and export preferences apply) and fail if another
  MarkText instance is running. Pandoc jobs (`--export <fmt>`, `--import`)
  do not conflict with a running instance.
- A watchdog aborts the job after 120 seconds (plus 60 seconds per
  additional batch input) so scripts never hang.
- The job flags are mutually exclusive and not supported together with
  opening other files in the same invocation.
