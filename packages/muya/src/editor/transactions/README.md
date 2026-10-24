# Edit transactions

`EditTransactions` owns edit batching and rule completion. `JSONState` owns the
document and applies complete operations literally. It has no event scheduling,
editing rules, history handling, or access to live Blocks.

Use `muya.transact(() => { ... })` for a synchronous command that changes several
Blocks or mixes Block methods with `Editor.updateContents`. Nested commands join
the outer scope. An exception aborts that scope, restores the committed document,
and publishes no change. An exception caught inside an outer scope still aborts
the outer transaction. Asynchronous work must finish before entering the scope;
never keep a transaction open across an `await`.
Calling `flush()` inside a scope does not split it. History navigation and
whole-document replacement are standalone boundaries and must run outside scopes.
Render-only whole-document rebuilds follow the same boundary: forced option
updates and locale changes flush earlier edits, or reject an active scope before
changing configuration. Pure appearance updates that do not rebuild remain valid
inside scopes.
Explicit commands isolate their undo step from preceding and following typing;
DOM typing events retain word/time grouping. Nested commands share the outer
transaction's original selection and undo boundary.

An API-only scope keeps its API source. If any live Block edit or explicit User
operation joins the scope, the complete command has User source, regardless of
nesting or operation order. Scopes share one undo boundary, retaining any explicit
command's isolation request. API calls with a non-merge history policy or replay
must remain standalone.

Block mutators update the live tree and enqueue their operations. Outside an
explicit scope, the coordinator batches those mutations until the next frame.
At completion, editing rules inspect the final candidate document and append
required operations. Intermediate move/replace states are never normalized.

The coordinator distinguishes three projection states:

- Live mutations: apply only the completing operations to Blocks, because the
  original changes are already present.
- Explicit operations: apply the completed operation through the common Block
  walker. Inside a scope, project the provisional operation immediately and
  enqueue it alongside Block mutations.
- Whole-document replacement: rebuild Blocks from the completed document.

All three enter the same commit path. The state and Block tree agree before
`json-change` is emitted. History receives the complete operation, including rule
effects. Whole-document undo boundaries also record that completed operation.
An incremental projection failure rebuilds from the candidate/committed snapshot
before publishing, using the same recovery path for provisional and final edits.
Rollback has internal document-update authority even when the failed command
enabled read-only mode. Recovery restores document content, keeps the current
read-only setting, and does not permit further user edits while locked.

Derived renderers read `transactions.candidateState`, an immutable snapshot of
committed state plus queued operations. Each new operation advances the candidate
incrementally before provisional projection, rather than replaying the growing
batch for every render. Public JSONState reads still describe the committed
document.

Reference definitions are cached by committed revision and a provisional
definition revision. Within a batch, ordinary text and metadata edits retain the
index; edits to definition paragraphs and structural changes invalidate it.
Discarding a batch that changed definitions also invalidates provisional reads.
Committed revision remains a conservative fallback for direct state replacement
and replay. Candidate root identity alone does not invalidate the index.

Undo and redo use replay mode and suppress new history recording. Replay and
history recording are independent options: a future collaboration transport can
replay completed operations while allowing History to transform its stacks.
Current preferences must not reinterpret recorded or received operations.

Rules live here rather than in individual input handlers or the state store.
The list rule reuses the Markdown parser/serializer boundary behavior; it does
not maintain another Markdown grammar. It examines affected lists and their
logical neighbors, preserving unrelated document subtrees.

Document replacement and destruction cancel pending frame work. Hosts should
call the public `muya.flush()` before persisting or switching documents so the
last pending keystroke belongs to the outgoing document.
