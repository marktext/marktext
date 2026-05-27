# Feature: Preferences System

> Feature ID: F04 | Safety Level: **CAUTION** | Process: main + renderer

---

## Scope

User preferences are persisted in main and mirrored to all renderer processes. Changes to the
preferences schema or store affect all windows simultaneously.

**Main**: `src/main/preferences/index.ts`, `src/main/preferences/schema.json`
**Renderer**: `src/renderer/src/store/preferences.ts`
**Shared types**: `src/shared/types/preferences.ts`
**Persistence file**: `{userDataPath}/preference.json` (at runtime, not in repo)

---

## Data Flow

```
App startup:
  Main Preference class reads preference.json from disk
  → validates against schema.json
  → sends preferences in BootInfo (mt::boot-info sync IPC)
  → renderer bootstrap.ts reads window.marktext.bootInfo.preferences
  → usePreferencesStore() initializes from bootInfo

User changes a preference:
  renderer: usePreferencesStore().SET_PREFERENCES(partial)
  → ipc.send('broadcast-preferences-changed', partial)
  → main: updates Preference class in memory + writes to disk
  → main: broadcasts to all windows via webContents.send('preferences-changed', partial)
  → all renderer windows: update their Pinia preference store
```

---

## Schema

Located at `src/main/preferences/schema.json`. Defines valid values for all preferences.
Changes to this file must be accompanied by a migration strategy for existing users.

Key preference groups (from `src/renderer/src/store/preferences.ts`):
- **General**: autoSave, titleBarStyle, startUpAction, language, zoom
- **Editor/Typography**: editorFontFamily, fontSize, lineHeight, codeFontFamily
- **Markdown editing**: autoPairBracket, endOfLine, defaultEncoding, tabSize
- **Theme**: theme, customCSSEnabled, customMarkdownCSS
- **Spell Check**: spellcheckerEnabled, spellcheckerLanguage
- **Keybindings**: keyboardShortcuts (user overrides)

---

## Risks

| Risk | Severity | Details |
|------|----------|---------|
| Schema change without migration | HIGH | Old preference.json may have invalid values; no automatic migration exists |
| Adding a preference without schema entry | MEDIUM | Validation will reject the new key in strict mode |
| Preference store divergence | MEDIUM | If renderer sets a pref that main doesn't know about, disk write may not include it |

---

## Change Rules

1. Any new preference key must be added to both `schema.json` and `PreferencesState` interface.
2. Default values must be defined in the Preference class (main) and mirrored in the store initializer.
3. New preferences affecting Muya behavior must be passed to Muya via `setOptions()`.
4. User-visible preference names must have i18n keys in `static/locales/`.
