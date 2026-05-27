# Specification Template

> Use this template for every new or modified specification.
> Copy to `ai-meta/specs/<feature>/spec.md` and fill in all fields.
> Do not leave placeholder text in an APPROVED spec.

---

## Spec Header

| Field | Value |
|-------|-------|
| **Spec ID** | SPEC-XXXX |
| **Feature ID** | F0X |
| **Feature Name** | _(name from features/INDEX.md)_ |
| **Status** | DRAFT / REVIEW / APPROVED / IN_PROGRESS / COMPLETED / ARCHIVED |
| **Author** | _(agent ID or human username)_ |
| **Created** | YYYY-MM-DD |
| **Last Updated** | YYYY-MM-DD |
| **PR / Branch** | _(if applicable)_ |

---

## 1. Problem Statement

> One paragraph. What is broken, missing, or needs to change? What is the observable symptom?
> No solution discussion here.

---

## 2. Proposed Solution

> Technical description of the change. What mechanism, pattern, or approach will be used?
> Reference existing patterns in the codebase where applicable.

---

## 3. Scope — Files to Modify

> List every file that will be modified. No surprises.

| File (from repo root) | Change Type | Description |
|-----------------------|-------------|-------------|
| `src/...` | ADD / MODIFY / DELETE | What changes |

**Files that will NOT be modified** (explicit exclusion to prevent scope creep):
- _(list files that might seem related but are out of scope)_

---

## 4. Behavioral Contract

> Define what MUST be true after the change. These are the acceptance criteria.
> Each contract item is testable.

```
GIVEN  [precondition]
WHEN   [action]
THEN   [observable result]
AND    [side effect, if any]
```

Example:
```
GIVEN  a markdown file is open in WYSIWYG mode
WHEN   the user types a closing backtick after `foo
THEN   the inline code span is rendered as <code>foo</code>
AND    the cursor is placed after the closing backtick
```

---

## 5. Process Boundary Analysis

| Boundary Crossed | Yes/No | Justification |
|------------------|--------|---------------|
| renderer ↔ main (IPC) | — | — |
| renderer ↔ muya | — | — |
| main ↔ filesystem | — | — |
| preload surface change | — | — |

If any boundary is crossed: list all IPC channels that will be added/modified/removed.

---

## 6. Regression Surface

> List existing tests that cover the area being changed.

| Test File | Coverage Area | Will it still pass? |
|-----------|--------------|---------------------|
| `test/unit/specs/...` | ... | YES / NEEDS UPDATE |

**New tests required**:
- [ ] `test/unit/specs/...` — describe what the new test must verify

---

## 7. Rollback Strategy

> How do we revert this change if it causes a regression?

```
git revert <commit-hash>
# and/or:
# Manual rollback steps if schema/data migration was involved
```

---

## 8. Assumptions and Open Questions

| # | Assumption / Question | Status |
|---|----------------------|--------|
| 1 | ... | ASSUMED / VERIFIED / OPEN |

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ... | LOW/MED/HIGH | LOW/MED/HIGH | ... |

---

## 10. Implementation Notes

> Optional: specific code patterns, edge cases, or gotchas discovered during analysis.
> Not implementation instructions — just facts that will help the implementer.
