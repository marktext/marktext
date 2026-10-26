# Local keyboard shortcuts

Adapted from `@hfelix/electron-localshortcut` 4.0.1
(https://github.com/hfelix/electron-localshortcut), including its atom-keymap,
keyboardevent-from-electron-accelerator and keyboardevents-areequal derivatives.
The upstream MIT notices are retained in [LICENSE](LICENSE).

The recorder and Electron window dispatcher share `KeyboardMapper`. Keeping them
in one source module prevents shifted digit/punctuation recordings from becoming
unreachable runtime accelerators (#4863). Platform and keyboard-layout inputs are
explicit on the mapper so compatibility can be tested without changing the OS.
Conflict checks use the same active mapper and recognize literal symbols such as
`Ctrl+Plus` as equivalent to their explicit Shift chord on the current layout.

The adapter retains layout-aware AltGr, dead-key, numpad, non-Latin and macOS
Dvorak-QWERTY-Command handling. It adds strict TypeScript boundaries, preserves
Shift with primary modifiers, and removes upstream's inactive debug/dead code.
Shifted digit/punctuation chords use the layout's base key whether the OS reports
that key or its shifted symbol. When a case-bearing base produces punctuation
(German `ß` → `?`), recording keeps the shifted symbol so the accelerator remains
valid. Existing literal symbol accelerators such as
`Ctrl+Plus` still match the corresponding shifted key; ordinary Shift text input
keeps its character semantics. Explicit `Command+Shift+=` is distinct from
`Command+=`, so a Shift binding cannot silently execute the unshifted command.
There are no runtime Node or Electron imports, so the same normalization runs in
the sandboxed renderer; Electron types are erased during bundling.
