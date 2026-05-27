# Evaluation Template

> Use this template to record the results of an implemented specification.
> Copy to `ai-meta/evaluations/<feature>/eval.md` after implementation is complete.

---

## Eval Header

| Field | Value |
|-------|-------|
| **Eval ID** | EVAL-XXXX |
| **Spec ID** | SPEC-XXXX |
| **Feature ID** | F0X |
| **Feature Name** | _(name from features/INDEX.md)_ |
| **Status** | IN_REVIEW / PASS / FAIL / PARTIAL |
| **Evaluated By** | _(agent ID or human username)_ |
| **Evaluation Date** | YYYY-MM-DD |
| **Commit / PR** | _(SHA or PR number)_ |

---

## 1. Implementation Summary

> Brief description of what was actually implemented. Note any deviations from the spec.
> If there are deviations, classify each as: JUSTIFIED / SPEC_VIOLATION / SCOPE_CREEP.

---

## 2. Files Modified (Actual vs Spec)

| File | In Spec? | Change Type | Notes |
|------|----------|-------------|-------|
| `src/...` | YES/NO | ADD/MODIFY/DELETE | Any deviation explanation |

> If any file was modified that was NOT in the spec → **SCOPE_CREEP** — must be justified.

---

## 3. Behavioral Contract Verification

> Test each contract item from the spec. Status: PASS / FAIL / PARTIAL / NOT_TESTED.

| Contract | Status | Evidence |
|----------|--------|----------|
| GIVEN ... WHEN ... THEN ... | PASS | Unit test: test/unit/specs/... line X |
| GIVEN ... WHEN ... THEN ... | FAIL | Description of failure |

---

## 4. Test Results

```
pnpm run typecheck    → PASS / FAIL (N errors)
pnpm run lint         → PASS / FAIL (N new errors)
pnpm run test:unit    → PASS / FAIL (N failed, N total)
pnpm run test:e2e     → PASS / FAIL / SKIPPED
Manual smoke test     → PASS / FAIL / NOT_RUN
```

**New tests added**:
- [ ] `test/unit/specs/...` — WRITTEN / NOT_WRITTEN

---

## 5. Regression Check

> Any existing tests that now fail? Any manually discovered regressions?

| Test | Status | Notes |
|------|--------|-------|
| `test/unit/specs/...` | PASS/FAIL | — |

---

## 6. Open Issues

> Any issues discovered during implementation or evaluation that are out of scope for this spec.

| # | Issue | Severity | Action |
|---|-------|----------|--------|
| 1 | ... | LOW/MED/HIGH | Log as tech debt / Open new spec / Fix immediately |

---

## 7. Verdict

```
OVERALL:  PASS / FAIL / CONDITIONAL_PASS

Conditions (if CONDITIONAL_PASS):
  - ...

Recommended next steps:
  - ...
```
