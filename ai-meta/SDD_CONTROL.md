# Specification-Driven Development Control — MarkText

> This file defines the SDD contract that governs all AI-assisted changes in this repository.

---

## Core Principle

**No spec = no change.**

Every non-trivial modification to application code must be preceded by a written specification
in `ai-meta/specs/<feature>/spec.md`. The spec is the contract. The implementation must match it.

---

## When a Spec is Required

| Change Type | Spec Required? |
|-------------|---------------|
| New feature or behavior | YES — full spec |
| Bug fix touching >1 file | YES — abbreviated spec (scope + contract) |
| Bug fix in single file, <10 lines | Inline comment documenting the fix is sufficient |
| Refactor (behavior-preserving) | YES — full spec with regression proof |
| Documentation / comment only | NO |
| Test addition only | NO |
| `ai-meta/` file update | NO |

---

## Spec Lifecycle

```
DRAFT → REVIEW → APPROVED → IN_PROGRESS → COMPLETED → ARCHIVED
```

- `DRAFT`: initial write. Agent may not start implementation.
- `REVIEW`: spec is complete. Human or senior agent confirms scope is safe.
- `APPROVED`: implementation may begin.
- `IN_PROGRESS`: implementation underway. Spec is frozen.
- `COMPLETED`: implementation done, tests pass, eval written.
- `ARCHIVED`: feature is stable, spec moved to historical record.

---

## Spec Quality Gates

A spec MUST pass all gates before moving to `APPROVED`:

1. **Scope Gate**: All files to be modified are listed explicitly.
2. **Boundary Gate**: Cross-process changes are flagged and justified.
3. **Regression Gate**: Existing tests covering the area are listed; new tests are planned.
4. **Rollback Gate**: A revert strategy is documented.
5. **i18n Gate**: Any user-visible string additions reference i18n keys.
6. **IPC Gate**: Any new IPC channels are pre-declared in `src/shared/types/ipc.ts`.

---

## SDD Enforcement via CI (Recommended Gates)

The following CI gate pattern is recommended for PR workflows:

```yaml
# .github/workflows/sdd-gate.yml (recommended addition)
# Check that any PR touching src/ also has a corresponding spec entry.
# Implementation: grep for modified src/ paths in PR diff;
# verify matching spec in ai-meta/specs/ exists and is not DRAFT.
```

> NOTE: This CI gate does not currently exist. Adding it is a future SDD adoption task.
> See Repository Analysis > SDD Adoption Strategy for the rollout plan.

---

## Spec Template Location

→ `ai-meta/specs/TEMPLATE.md`

---

## Completed Specs Index

| Spec | Feature | Status | Last Updated |
|------|---------|--------|--------------|
| `specs/editor-core/spec.md` | ContentState / WYSIWYG core | EXAMPLE | 2026-05-27 |

---

## Violation Handling

If an AI agent detects that an existing PR or commit modified application code without a
corresponding spec:

1. Document the unspecced change in the relevant eval file under `evaluations/`.
2. Write a retroactive spec (`STATUS: RETROACTIVE`).
3. Flag the PR for human review.
4. Do not block the existing work; add the spec debt note.
