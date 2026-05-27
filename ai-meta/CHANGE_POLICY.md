# AI Change Policy — MarkText

> Defines what AI agents are permitted to do, restricted from doing, and required to do
> before, during, and after any code change.

---

## PERMITTED (Green Zone)

| Area | Condition |
|------|-----------|
| `src/renderer/src/store/` | Spec required; no new Pinia store keys without type update in shared/types |
| `src/renderer/src/components/` | Spec required; Vue 3 SFC only; no `Options API` |
| `src/renderer/src/i18n/` | Adding i18n keys only; never removing existing keys |
| `src/main/ipc/` | Spec required; new handlers must be registered in `src/shared/types/ipc.ts` |
| `src/main/menu/` | Spec required; menu actions must emit IPC, not call Node APIs directly |
| `src/muya/lib/ui/` | Spec required; UI overlays only; no ContentState mutation |
| `test/unit/specs/` | Always permitted; adding tests never requires a spec |
| `test/e2e/` | Always permitted; adding tests never requires a spec |
| `docs/` | Always permitted |
| `static/locales/` | Permitted for translation additions; never remove keys |
| `ai-meta/` | Always permitted (this layer is self-maintaining) |

---

## RESTRICTED (Yellow Zone — spec + human acknowledgment required)

| Area | Risk | Restriction |
|------|------|-------------|
| `src/muya/lib/contentState/` | HIGH | 25+ mixed-in controller files; mutation order matters; no partial refactors |
| `src/muya/lib/parser/` | HIGH | Custom inline tokenizer; rule changes affect export, render, and edit simultaneously |
| `src/preload/index.ts` | HIGH | Any removal of contextBridge surface breaks renderer; additions must be typed in ipc.ts |
| `src/shared/types/ipc.ts` | HIGH | Removing or renaming channels breaks callers silently in .js files; only additive changes |
| `src/main/preferences/schema.json` | MEDIUM | Schema changes require migration logic; old prefs files must still load |
| `src/main/windows/` | MEDIUM | Window lifecycle (create/destroy) is entangled with Accessor and WindowManager |
| `src/renderer/src/store/editor.ts` | HIGH | Central document state; 800+ lines; changes ripple to Muya, IPC, and file system |
| `src/renderer/src/bootstrap.ts` | HIGH | Renderer initialization sequence; order of operations is load-bearing |

---

## LOCKED (Red Zone — do not modify under any circumstances)

| File/Area | Reason |
|-----------|--------|
| `src/main/globalSetting.ts` | Vite compile-time global injection; wrong values corrupt version strings app-wide |
| `electron.vite.config.ts` | Build system configuration; changes require release engineering sign-off |
| `electron-builder.yml` | Packaging configuration; changes affect code-signing, auto-updater, and distribution |
| `src/muya/lib/parser/marked/` | Vendored/forked marked parser; changes invalidate upstream merge path |
| `pnpm-lock.yaml` | Managed by pnpm; never edit manually |
| `patches/` | Patch files for native modules; manual edit breaks native rebuild |
| `.github/workflows/` | CI configuration; changes require release engineering sign-off |

---

## REQUIRED ACTIONS (before any change)

1. Read `ai-meta/AGENT_GUIDE.md` in full.
2. Identify all files that will be modified.
3. Verify none are in the Locked zone.
4. For Restricted zone files, obtain explicit acknowledgment.
5. Write or verify a spec in `ai-meta/specs/<feature>/spec.md`.

---

## REQUIRED ACTIONS (after any change)

1. `pnpm run typecheck` → must pass with zero errors.
2. `pnpm run lint` → zero new errors.
3. `pnpm run test:unit` → all tests pass.
4. Update `ai-meta/evaluations/<feature>/eval.md`.

---

## IPC Channel Policy

- New channels: must be added to the correct interface in `src/shared/types/ipc.ts`.
- Channel naming: use `mt::` prefix for all new channels.
- Removing channels: forbidden unless all callers (renderer + main + preload) are updated atomically.
- Sync channels (`sendSync`): avoid; only `mt::boot-info` justifies synchronous IPC at startup.

---

## Muya-Specific Policy

- Muya files (`src/muya/`) remain **JavaScript**. Do not introduce `.ts` files.
- The ambient shim `src/types/muya.d.ts` provides TypeScript declarations for muya imports.
- ContentState mixins follow the pattern: `const featureCtrl = (ContentState) => { ContentState.prototype.method = function() {...} }`.
  New controllers MUST follow this pattern.
- The `Muya.use(plugin)` static plugin registration system is the correct extension point for new UI overlays.
- Direct DOM manipulation inside muya is expected; do not replace it with Vue reactivity.

---

## Cross-Process Change Checklist

When a change crosses process boundaries (e.g., renderer ↔ main), ALL of the following must be done atomically in the same commit:

```
[ ] IPC channel declared in src/shared/types/ipc.ts
[ ] Handler registered in src/main/ipc/<handler>.ts
[ ] Caller exposed in src/preload/index.ts via contextBridge
[ ] Caller invoked in renderer via window.electron.* or window.fileUtils.*
[ ] Types consistent across all four touch points
```
