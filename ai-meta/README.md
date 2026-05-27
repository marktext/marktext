# AI Meta-Layer — MarkText

> **Read this file first.** This directory is the AI-agent control system for the MarkText repository.
> It contains zero application code. All files here are analytical scaffolding only.

---

## Purpose

This `/ai-meta/` layer enables AI agents (Claude Code, GitHub Copilot, etc.) to safely navigate,
modify, and evaluate the MarkText codebase without violating architectural boundaries or introducing
regressions in a high-complexity, multi-process Electron application.

---

## Mandatory Reading Order for AI Agents

```
1. ai-meta/AGENT_GUIDE.md              ← Operating system; start HERE
2. ai-meta/CHANGE_POLICY.md            ← What is forbidden / permitted
3. ai-meta/SDD_CONTROL.md             ← Enforcement rules for SDD
4. ai-meta/architecture/OVERVIEW.md   ← Runtime structure
5. ai-meta/architecture/MODULE_MAP.md ← File → module mappings
6. ai-meta/features/INDEX.md          ← Feature decomposition
7. ai-meta/features/<target>.md       ← Feature-specific context
8. ai-meta/specs/<target>/spec.md     ← Specification before editing
9. ai-meta/evaluations/<target>/eval.md ← Post-change evaluation
```

---

## Directory Map

```
ai-meta/
├── README.md                      ← This file (orientation)
├── AGENT_GUIDE.md                 ← Agent OS: step-by-step protocol
├── SDD_CONTROL.md                 ← SDD rules; spec-before-code gates
├── CHANGE_POLICY.md               ← AI permission boundaries
│
├── architecture/
│   ├── OVERVIEW.md               ← Process model, data flow, boundaries
│   └── MODULE_MAP.md             ← Authoritative file→module index
│
├── features/
│   ├── INDEX.md                  ← Feature registry with risk levels
│   ├── editor-core.md            ← Muya WYSIWYG engine (PRIMARY EXAMPLE)
│   ├── ipc-bridge.md             ← Main↔Renderer IPC contract
│   ├── preferences-system.md    ← Settings persistence and schema
│   ├── file-system.md            ← File I/O, encoding, watchers
│   ├── spell-checker.md          ← Spell check integration
│   └── theme-system.md           ← Theme loading and CSS vars
│
├── specs/
│   ├── TEMPLATE.md               ← Canonical spec format
│   └── editor-core/
│       └── spec.md               ← PRIMARY EXAMPLE: ContentState spec
│
└── evaluations/
    ├── TEMPLATE.md               ← Canonical eval format
    └── editor-core/
        └── eval.md               ← PRIMARY EXAMPLE: ContentState eval
```

---

## Constraints (Non-Negotiable)

- **Read-only**: This layer never modifies application files.
- **Evidence-based**: All claims are traceable to file paths and line evidence.
- **No speculation**: Uncertain areas are marked `PARTIAL` or `UNVERIFIED`.
- **LLM-optimized**: Files are structured for token-efficient parsing.

---

## Version

Generated: 2026-05-27 | Codebase commit: develop branch | MarkText v1.x (Electron 42 / Vue 3)
