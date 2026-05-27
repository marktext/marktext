# AI Agent Operating Guide — MarkText

> **Every AI agent MUST follow this protocol in full, in order, before making any change.**
> Skipping steps is forbidden. "No spec = no change" is an absolute rule.

---

## STEP 0 — Orientation (always first)

1. Read `ai-meta/README.md` (directory map).
2. Read `ai-meta/CHANGE_POLICY.md` (permission boundaries).
3. Read `ai-meta/SDD_CONTROL.md` (SDD enforcement rules).

---

## STEP 1 — Architecture Context

4. Read `ai-meta/architecture/OVERVIEW.md`.
5. Read `ai-meta/architecture/MODULE_MAP.md`.
6. Identify which process boundary your change crosses (main / preload / renderer / muya).
   If a change crosses **more than one** process boundary, flag this as HIGH RISK before proceeding.

---

## STEP 2 — Feature Context

7. Read `ai-meta/features/INDEX.md`.
8. Locate the relevant feature file under `ai-meta/features/<feature>.md`.
   - If no feature file exists for your target area, **STOP** and document a new feature file first.
9. Confirm the feature's `Safety Level`. Rules by level:
   - `SAFE`: proceed with spec.
   - `CAUTION`: proceed with spec + explicit IPC/state analysis.
   - `HIGH RISK`: proceed only with spec + human review checkpoint.
   - `LOCKED`: do not modify. Escalate to human maintainer.

---

## STEP 3 — Specification Gate (SDD)

10. Check `ai-meta/specs/<feature>/spec.md` for an existing specification.
    - If spec exists: verify it is current (matches actual code). Update if stale.
    - If spec does not exist: **WRITE THE SPEC FIRST** using `ai-meta/specs/TEMPLATE.md`.
11. The spec MUST define:
    - Exact files to be modified (absolute paths from repo root).
    - Exact behavioral contract (what changes, what must not change).
    - Regression surface (which tests cover the area).
    - Rollback strategy (how to revert if broken).
12. **Do not write application code until the spec is committed.**

---

## STEP 4 — Implementation

13. Follow ONLY the scope defined in the spec. Zero scope creep.
14. TypeScript rules: `strict: true`. No `any` without `eslint-disable` comment explaining why.
15. Muya (`src/muya/`) is JavaScript. Do not introduce TypeScript into muya files.
16. Renderer code must never use `require()`. ESM only.
17. Main/preload code must never use `import()` dynamic imports for Electron API modules.
18. New IPC channels MUST be registered in `src/shared/types/ipc.ts` before use.
19. All new user-visible text must be routed through `t()` (i18n).

---

## STEP 5 — Validation

20. Run: `pnpm run typecheck` — zero errors permitted.
21. Run: `pnpm run lint` — zero new errors permitted.
22. Run: `pnpm run test:unit` — all tests must pass.
23. If the change touches rendering, manually verify with `pnpm run dev`:
    - Open a markdown file.
    - Verify the affected feature works end-to-end.
24. Document results in `ai-meta/evaluations/<feature>/eval.md` using `TEMPLATE.md`.

---

## STEP 6 — Completion Checklist

```
[ ] spec.md written and accurate
[ ] Only files listed in spec.md were modified
[ ] pnpm run typecheck → PASS
[ ] pnpm run lint → PASS
[ ] pnpm run test:unit → PASS
[ ] No new IPC channels without ipc.ts entry
[ ] No new user-facing text without i18n key
[ ] eval.md updated with actual results
[ ] No files in ai-meta/ were modified (except spec/eval updates)
```

---

## ABSOLUTE PROHIBITIONS

| Action | Reason |
|--------|--------|
| Modify `src/muya/` parser rules without a spec | Parser is shared by export, render, and edit paths — regressions cascade silently |
| Add Node.js APIs to renderer code | Renderer is sandboxed; CSP will silently block it or cause security violations |
| Remove `contextBridge` entries from preload | Breaks all renderer↔main communication |
| Edit `src/shared/types/ipc.ts` to remove channels | Breaks existing callers without compile error if channel is string-cast |
| Modify `electron-builder.yml` or `electron.vite.config.ts` | Build system changes require release engineering review |
| Rename or move files without updating all imports | TypeScript path aliases (`@`, `common`, `muya`) will silently break in JS files |
| Touch `src/main/globalSetting.ts` | Defines compile-time global constants injected by Vite; wrong values corrupt runtime behavior |

---

## Quick Reference: Process Boundaries

```
┌─────────────────────────────────────────────────────────┐
│  Renderer (src/renderer/)  — sandboxed, ESM, Vue 3     │
│  ↕ ONLY via contextBridge (src/preload/index.ts)        │
├─────────────────────────────────────────────────────────┤
│  Preload (src/preload/)    — bridge, CommonJS           │
│  ↕ ONLY via ipcMain/ipcRenderer typed channels          │
├─────────────────────────────────────────────────────────┤
│  Main (src/main/)          — Node.js, CommonJS          │
│  ↕ ONLY via IPC to renderer                             │
├─────────────────────────────────────────────────────────┤
│  Muya (src/muya/)          — DOM/JS, no Electron APIs  │
│  (Exception: parser/render/plantuml.js uses Node zlib)  │
└─────────────────────────────────────────────────────────┘
```
