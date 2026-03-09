# ADR-0001: Icon Drawer Defaults and Persistence

- Status: Accepted
- Date: 2026-03-09

## Context

MarkText needed a first-party icon drawer with:

- useful defaults for markdown authoring,
- support for project-specific custom/local icons,
- persistence for feature flags and icon library state,
- a path to extend icon sources later without changing core editor behavior.

We also needed to avoid introducing a large new persistence dependency in the renderer process.

## Decision

We chose the following design:

1. Store icon drawer feature flags and user-managed icon entries in a dedicated SQLite database file: `feature-config.sqlite`.
2. Keep default icons as a bundled JSON dataset generated from the GitHub-style shortcode list at https://gist.github.com/rxaviers/7360908 and mapped to supported Unicode emoji entries.
3. Model icons with explicit types:
   - `emoji_text` for built-in shortcode-based defaults.
   - `image_path` for custom/local file and URL icons.
4. Insert default icons into markdown as GitHub-style shortcodes (for example `:smile:`), while image-based icons are inserted as images.
5. Broadcast icon library updates through main-process IPC so every open window stays in sync.

## Consequences

Positive:

- Users get a large, familiar default icon set immediately.
- The drawer supports both markdown shortcodes and image icons with clear behavior.
- Persistence is centralized and simple to evolve (feature flags + icon catalog tables).
- Multi-window state consistency is handled through existing IPC patterns.

Tradeoffs:

- The current default dataset only includes shortcode entries that can be mapped to Unicode emojis.
- Persistence depends on the `sqlite3` CLI availability in the runtime environment.
- Adding remote icon packs later will require additional schema and sync considerations.
