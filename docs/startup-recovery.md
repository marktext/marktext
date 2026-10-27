# Startup recovery and application state

This document tracks the incremental replacement of the legacy window buffer
scanner. The contracts are in
`packages/desktop/src/shared/types/applicationState.ts`. Adding the contracts does
not activate the new startup path.

## Ownership

| Concept                | Identity and responsibility                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| Preferences            | Global rules and defaults, independent of the current window                                        |
| Session                | Latest application's editor-window membership; no session archive                                   |
| Window                 | Stable UUID, own layout, bounds, roots, documents and active tab                                    |
| Workspace              | Canonical root set; root display order does not change identity                                     |
| Workspace recent state | Bounded reopening template containing ordinary files, never draft identities or recovery references |
| Document               | Independent editing instance, including untitled or pending files; a pathname is not a document ID  |
| Recovery record        | Latest unsaved content for one window/document, separate from metadata                              |

Restoring a window reuses its identity and document IDs. Reopening a workspace in a
new window uses new document IDs and the most recently active workspace template.
Two windows may use the same workspace with independent contents and layouts.
An empty window has no workspace.

## Storage and invariants

The actual `userData` directory, including `--user-data-dir`, owns:

```text
preferences.json
state/application-state.json
recovery/<windowId>/<documentId>.json
```

The state file contains metadata, not Markdown bodies. Unsaved content is written
before metadata references it. Saved/discarded records temporarily replace dirty
records until metadata is committed, then can be deleted. Atomic replacement of
one JSON file does not make the whole operation a multi-file transaction.

`disk` documents must have an existing file resource, `pendingCreation=false`, and
an existing disk baseline. `empty` can describe an untouched untitled buffer or a
named file that has not been created. Changed contents use `recovery` even if the
text is empty. Disk fingerprints hash raw bytes; view state hashes editor text.

The session holds current windows, or one `lastWindow` fallback when none remain.
Individual close removes membership; application quit preserves the final set of
windows before destroying them. Save/Don't Save/Cancel is independent of startup
preferences. Defaults always create a fresh layout object, never shared mutable
state between windows.

No migration of preferences, legacy snapshots, or localStorage is planned.
Unrecognized/damaged input must not prevent startup or be automatically overwritten.
Legacy files are retained and never used to infer an unbounded list of windows.
Orphan recovery management and expiry-based cleanup are deferred; known successful
save/discard cleanup and ordinary recent-cache bounds are in scope.

## Reviewable implementation sequence

All PRs target `develop`. Until prerequisites are merged, dependent branches retain
their prerequisite commits and identify them in their PR descriptions.

| PR  | Scope                                                     | Direct prerequisites |
| --- | --------------------------------------------------------- | -------------------- |
| 01  | Contracts, defaults, resource/workspace identity          | None                 |
| 02  | Tolerant preferences and settings UI                      | 01                   |
| 03  | Atomic metadata/recovery storage                          | 01                   |
| 04  | Document lifecycle and checkpoint consistency             | 03                   |
| 05  | Session, startup plans and close coordination             | 01                   |
| 06  | Bounded workspace reopening templates                     | 01                   |
| 07  | Window layout, components and geometry                    | 01                   |
| 08  | Tree/editor view-state adapters                           | 01                   |
| 09  | Real single-window IO and IPC integration                 | 02, 04, 05, 07, 08   |
| 10  | Multi-window/workspace integration and default activation | 06, 09               |

PRs 02, 03, 05, 06, 07 and 08 can be implemented independently after 01. Modules
accept typed external ports; tests replace external effects, not the tested state
transitions. Storage tests use real temporary directories and interrupted writes.
Integration PRs must exercise real Electron flows with throwaway profiles.

## Issue coverage

Issue references record scope, not a claim that every referenced issue is fixed.
Only an end-to-end verified resolution should use a closing keyword. Previously
closed issues remain closed and serve as historical regression requirements.

| Issues                                                                                                                                                                                                                                                                                                                                                       | Requirement                                       | Owning PRs / closing policy                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [#519](https://github.com/marktext/marktext/issues/519)                                                                                                                                                                                                                                                                                                      | Restore focus/typewriter and other view modes     | 07 and 09/10; close only after actual restart tests                                                                 |
| [#2345](https://github.com/marktext/marktext/issues/2345)                                                                                                                                                                                                                                                                                                    | Remember folder and opened-file section expansion | 07, 08, 10; close only after tree/section restart tests                                                             |
| [#5596](https://github.com/marktext/marktext/issues/5596)                                                                                                                                                                                                                                                                                                    | Unsaved window-close confirmation                 | Closing fix belongs to [#5912](https://github.com/marktext/marktext/pull/5912); retain regressions in 04, 05, 09/10 |
| [#732](https://github.com/marktext/marktext/issues/732), [#3500](https://github.com/marktext/marktext/issues/3500)                                                                                                                                                                                                                                           | Recovery and unnamed document protection          | Historical references for 01, 03, 04, 09/10; no new periodic-backup or version-history promise                      |
| [#645](https://github.com/marktext/marktext/issues/645), [#386](https://github.com/marktext/marktext/issues/386), [#3577](https://github.com/marktext/marktext/issues/3577), [#3084](https://github.com/marktext/marktext/issues/3084), [#3533](https://github.com/marktext/marktext/issues/3533), [#2521](https://github.com/marktext/marktext/issues/2521) | Reopen files, folders and workspaces              | Historical references for 05, 06, 10                                                                                |
| [#3717](https://github.com/marktext/marktext/issues/3717), [#2134](https://github.com/marktext/marktext/issues/2134), [#1920](https://github.com/marktext/marktext/issues/1920), [#1192](https://github.com/marktext/marktext/issues/1192), [#2467](https://github.com/marktext/marktext/issues/2467)                                                        | Consistent layout restoration                     | Historical references for 07, 09/10                                                                                 |
| [#2268](https://github.com/marktext/marktext/issues/2268), [#3049](https://github.com/marktext/marktext/issues/3049), [#2421](https://github.com/marktext/marktext/issues/2421), [#3818](https://github.com/marktext/marktext/issues/3818)                                                                                                                   | Preserve sidebar dimensions and collapse intent   | Historical regressions for 07/08                                                                                    |
| [#143](https://github.com/marktext/marktext/issues/143), [#2672](https://github.com/marktext/marktext/issues/2672)                                                                                                                                                                                                                                           | Window bounds and document view positions         | Historical regressions for 07/08                                                                                    |

Adjacent requests require separate evidence and are not closed by this plan:

- [#5040](https://github.com/marktext/marktext/issues/5040): Linux/X11 native-dialog
  destruction crash; close coordination is relevant but must not claim a platform
  fix without its reproducer passing.
- [#3883](https://github.com/marktext/marktext/issues/3883) and
  [#2665](https://github.com/marktext/marktext/issues/2665): optional suppression of
  exit prompts/periodic snapshot behavior is not introduced here. Clean documents
  still close without prompts.
- [#2300](https://github.com/marktext/marktext/issues/2300): general window startup
  performance needs measurement beyond eliminating stale snapshot windows.
- [#5727](https://github.com/marktext/marktext/issues/5727): OS titlebar-button
  placement is unrelated to per-window geometry persistence.
- [#5902](https://github.com/marktext/marktext/issues/5902): external reload and
  cloud-sync data loss is a watcher/reload problem, not established by recovery tests.
- [#5843](https://github.com/marktext/marktext/issues/5843): file-URI launch parsing
  needs its own explicit-input reproduction before claiming resolution.
- [#3894](https://github.com/marktext/marktext/issues/3894): preference export/backup
  is not provided by keeping runtime state separate from preferences.
