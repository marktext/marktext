# MarkText AI Editor — v1 Implementation Plan

## 1. Objective

Turn this MarkText fork into a simple, cross-platform AI-assisted Markdown
editor for non-technical users:

```text
open a document → write normally → ask AI → optionally edit safely → undo if needed
```

The AI integration is a document feature, not a coding-agent feature. Preserve
MarkText, Muya, existing file operations, themes, menus, shortcuts, source-code
mode, and normal save behavior. Add only the following product surface:

- a right-side AI assistant panel;
- explicit answer, precise-edit, and full-rewrite modes;
- a single-document edit Agent that returns validated local edits;
- one configurable OpenAI-compatible or Anthropic-compatible connection;
- persistent per-document chat history;
- persistent, deterministic AI revision recovery.

Do not introduce workspaces, repositories, Git, shell access, MCP, plugins,
general coding agents, provider tool calling, accounts, cloud sync, server infrastructure, RAG,
embeddings, web search, multi-agent loops, or provider marketplaces.

## 2. Decisions and user behavior

### 2.1 Three explicit interaction modes

The panel must provide a visible mode switch directly above the input:

- `问答` / `Answer`: answer the user's question using the current document as
  context. The result is chat text only. This mode must never create a revision
  or call the document mutation path.
- `精确修改` / `Edit`: modify only the requested parts of the document. The
  model returns one or more exact `SEARCH/REPLACE` blocks; the main process
  validates and applies them to a captured snapshot, then the application
  applies the locally generated Markdown after safety checks.
- `全文重写` / `Rewrite`: an explicit opt-in mode for translation or broad
  rewrites. Only this mode permits the model to return a complete Markdown
  document. The application applies it automatically after safety checks.

Remember the last selected mode locally. Every request records its mode, so a
mode switch while a request is running cannot change the request's behavior.
The default mode for a new installation is `Answer`.

This explicit mode is the safety boundary. Do not infer whether a request is an
edit from natural language or from the model's response.

### 2.2 AI panel

Add a right-side flex panel without replacing the existing left sidebar:

- default width: 380px;
- minimum/maximum width: 320px/520px;
- collapsible and resizable with the existing drag-bar conventions;
- width and open state persist locally;
- light and dark themes use existing CSS variables;
- multiline input; clicking Send submits; Enter and Shift+Enter insert a
  newline so IME composition cannot submit a request accidentally;
- one active request at a time; disable duplicate submission;
- show loading and `停止` / `Stop` while a request is active;
- show concise, human-readable errors without raw stack traces;
- show a configuration link when no usable connection is configured.

Expose the panel through `View → AI Assistant` and a cross-platform command
shortcut. The panel itself also has a close/collapse control. Do not require
users to understand AI APIs to use the panel.

Suggested empty-state examples:

```text
帮我把这篇文章写得更容易理解
检查有没有错别字
给这一段加一个例子
帮我总结一下
```

### 2.3 Settings

Add an `AI` category to the existing settings window. Store one active
connection, not a profile list:

- protocol: `OpenAI Chat Completions` or `Anthropic Messages`;
- API URL: an HTTPS Base URL or complete endpoint URL;
- API key;
- model name;
- `保存并测试` / `Save and test` button;
- explicit key deletion action.

Only HTTPS URLs are accepted. For convenience, resolve the provider's standard
path when a Base URL is entered: OpenAI `/chat/completions` and Anthropic
`/v1/messages`. Complete endpoint URLs remain unchanged, and redirects are not
followed. The settings page must explain that the key is stored locally.

The key is stored in a separate local configuration file under Electron's
`userData` directory, as explicitly chosen for this fork. It is never included
in renderer preference state, IPC responses, logs, error messages, chat history,
or Git-tracked files. Use atomic writes and best-effort owner-only permissions.
The UI displays only whether a key is configured; it never reads the stored key
back into the renderer. A blank key field keeps the existing key; deletion is
explicit.

Provide complete English and Simplified Chinese translations. Other existing
MarkText locales fall back to English for the new AI strings.

## 3. AI service and protocol boundary

Keep networking out of Vue components. The renderer calls a typed IPC facade;
the main process owns URL validation, key loading, HTTPS requests, cancellation,
and response normalization.

### 3.1 Shared types

Introduce types equivalent to:

```ts
type AiProtocol = 'openai-chat-completions' | 'anthropic-messages'
type AiInteractionMode = 'answer' | 'edit' | 'rewrite'

interface AiConnectionSettings {
  protocol: AiProtocol
  endpoint: string
  model: string
  hasApiKey: boolean
}

interface AiChatMessage {
  id: string
  role: 'user' | 'assistant'
  mode: AiInteractionMode
  content: string
  createdAt: number
  revisionId?: string
  editSummary?: AiEditSummary
}

interface AiRequest {
  requestId: string
  documentId: string
  baseMarkdown: string
  mode: AiInteractionMode
  instruction: string
  conversation: AiChatMessage[]
}

interface AiResponse {
  requestId: string
  documentId: string
  mode: AiInteractionMode
  content: string
  markdown?: string
  editSummary?: AiEditSummary
}

interface AiEditOperationSummary {
  startLine: number
  endLine: number
  addedLines: number
  removedLines: number
  afterStartLine?: number
  afterEndLine?: number
  afterStartOffset?: number
  afterEndOffset?: number
}

interface AiEditSummary {
  operationCount: number
  addedLines: number
  removedLines: number
  operations: AiEditOperationSummary[]
}
```

The exact file locations must follow the repository's existing shared IPC and
type conventions.

### 3.2 IPC operations

Add typed operations for:

- reading redacted AI settings;
- saving endpoint/protocol/model and optionally replacing the key;
- deleting the key;
- testing the saved connection;
- starting an AI request;
- cancelling a request by `requestId`;
- loading and clearing per-document chat messages;
- preparing and committing a revision;
- restoring a revision;
- migrating document identity on application-controlled Save As/rename/move.

The renderer must not import Node APIs, read the AI configuration file, or make
the provider request directly.

### 3.3 Provider requests

Support text messages only. The implementation follows the providers' official
HTTP shapes: OpenAI-compatible requests use Bearer authentication and Chat
Completions responses; Anthropic-compatible requests use `x-api-key`, a fixed
stable `anthropic-version` header, and Messages responses. See the [OpenAI API
reference](https://platform.openai.com/docs/api-reference/backward-compatibility)
and [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages/create).

Do not add provider SDKs, streaming, tool calls, function calls, special Azure
authentication, or arbitrary custom headers. The only URL normalization is the
deterministic provider-path resolution described in the settings section.

Use separate prompts for the three modes. The authoritative runtime templates,
including the connection-test prompt and precise-edit repair/document message
builders, live in `packages/desktop/src/main/ai/prompts.ts`. Keep this plan
focused on prompt behavior and constraints rather than duplicating the source
text here.

Always send the current complete Markdown document and at most the ten most
recent persisted messages for that document. The precise-edit Agent parses and
validates every block before applying any block. A missing match, non-unique
match, overlap, malformed response, truncation, or second failed validation
causes the complete request to fail without mutation. The Agent may make one
automatic correction request with the validation error; it never uses fuzzy
matching. Rewrite output is parsed as plain Markdown and rejects an empty or
unambiguously wrapped outer code fence.

### 3.4 Single-document edit Agent

The precise-edit mode is implemented as a small main-process Agent, not as a
general coding agent. It receives only the active document and conversation
context and has one capability: produce local text replacements for that
document.

The response uses request-specific variants of this protocol:

```text
SEARCH_MARKER <request-token>
exact existing text
DIVIDER_MARKER <request-token>
replacement text
REPLACE_MARKER <request-token>
```

The Agent rejects extra prose, empty SEARCH blocks for non-empty documents,
missing or repeated matches, overlapping ranges, no-op replacements, more than
32 blocks, and truncated responses. It validates all blocks against the same
captured Markdown, applies them atomically in memory, and returns the resulting
Markdown plus line-level statistics. A failed parse or match receives one
structured correction request; the second failure leaves the document untouched.

The parser accepts both the request-tokenized markers above and the plain
Aider-compatible `<<<<<<< SEARCH`, `=======`, and `>>>>>>> REPLACE` marker lines.
This compatibility path still requires exact unique SEARCH matches and the same
atomic validation rules; it only tolerates providers that drop the request token
from their response.

The request token prevents a Markdown document containing ordinary conflict
markers from confusing the parser. The implementation is an independent
TypeScript implementation inspired by Aider's Apache-2.0 edit-block protocol
and OpenCode's unique old/new text validation; no provider tool-calling is
required.

The Agent also returns the exact changed span in the resulting document. The
renderer uses these ranges to provide navigation markers without exposing the
raw edit protocol in chat.

## 4. Document mutation, safety, and history

### 4.1 Existing editor path

Use the current Muya and editor-store paths discovered in this repository:

- read the active document from the editor/store's current Markdown;
- apply the Agent's locally synthesized Markdown through `Muya.replaceContent()`
  as one logical undo boundary;
- apply source-code-mode changes through CodeMirror's normal value/change path;
- let the existing `json-change → LISTEN_FOR_CONTENT_CHANGE` pipeline update
  dirty state, tab state, TOC, word count, and normal Save behavior.

Never write AI output directly to the Markdown file, mutate rendered DOM, or
destroy/recreate Muya to apply a result.

After a successful AI edit, the renderer tracks only that latest AI revision per
tab. It shows yellow markers until the corresponding file save succeeds, then
green markers until the next successful AI edit. Answer requests and
no-op/failed edits do not replace the marker set. Ordinary editor changes shift
the tracked ranges using the observed Markdown delta; undoing to the pre-edit
snapshot hides them and redoing the AI snapshot shows them again.

The source editor shows exact line markers in a CodeMirror gutter. WYSIWYG mode
shows a narrow overview ruler at the editor edge; clicking either view moves to
the changed source line using the existing Muya offset-cursor bridge. This is a
renderer-only feature and does not add line mapping or decoration APIs to Muya,
keeping upstream synchronization low-cost. Marker state is session-scoped and
is not restored after an application restart.

### 4.2 Request concurrency

Each request captures `requestId`, `documentId`, and exact `baseMarkdown`.
The renderer captures the active tab identity after flushing the editor, loads
chat history for that same document, and rechecks the tab and document identity
before sending the request. The main-process Agent receives only that captured
Markdown snapshot; it does not read other open tabs or the filesystem.
Before applying an edit, verify all three conditions:

1. the same document is still active and open;
2. the current Markdown still equals `baseMarkdown`;
3. the request was not cancelled.

If the user edited the document during generation, discard the edit result and
show a retry message. If the document was switched or closed, never apply the
result to the new active document. Cancellation leaves the document untouched.

Answer responses do not mutate documents; they may still be shown if the user
edited the document while waiting, with a small “based on the document at send
time” indication.

### 4.3 Persistent revision journal

Store complete Markdown snapshots in an application-managed append-only journal
under `userData`. Do not use Git, a database server, cloud storage, or accounts.

Use a revision shape equivalent to:

```ts
interface DocumentRevision {
  id: string
  documentId: string
  createdAt: number
  beforeMarkdown: string
  afterMarkdown: string
  instruction: string
  status: 'prepared' | 'committed'
  conversationMessageId?: string
}
```

Document identity is a hash of the normalized absolute path for saved files.
Unsaved files use their stable tab ID. Application-controlled Save As, rename,
and move operations migrate the journal and chat identity; an external rename
may start a new identity.

The edit transaction is:

```text
capture base
→ receive and validate precise edit blocks or explicit rewrite Markdown
→ synthesize the complete after snapshot locally
→ atomically persist prepared revision
→ apply through Muya/CodeMirror
→ verify editor/store state
→ commit revision and chat message
```

Prepared but uncommitted entries are never presented as successful edits. A
crash may leave a recoverable prepared snapshot; startup recovery must ignore it
as a chat result and retain it for safe cleanup/diagnostics.

### 4.4 Deterministic undo

Each committed edit shown in chat has `撤销这次修改` / `Undo this edit`.

Undo never calls the model. It is allowed only when the current Markdown still
equals that revision's `afterMarkdown`; otherwise refuse with a clear message
instead of overwriting later human changes. Restoration creates a new safety
revision, applies the stored `beforeMarkdown` through the same editor path, and
leaves the original journal entry intact.

## 5. Chat persistence and UI state

- Persist chat messages locally per document, including mode, optional revision
  ID, and concise local-edit statistics. Never persist the raw edit protocol or
  a duplicate full-document response for precise edits.
- Reload the matching chat when the active document changes.
- Keep chat history separate from editor undo/redo and persistent revisions.
- Do not expose Git terminology or model/system-prompt/token controls.
- Clear-chat behavior may remove visible conversation messages but must never
  delete persistent revisions or make rollback unavailable.

Use the existing Pinia stores and layout buffering conventions. Keep AI panel
state independent from the existing filesystem sidebar state so both panels can
coexist without changing ordinary MarkText navigation.

## 6. Implementation phases

1. Rewrite this plan and add shared AI types/IPC contracts.
2. Add the main-process AI settings store, URL validation, request client,
   response normalization, cancellation, and redacted settings IPC.
3. Add the AI settings page and English/Simplified Chinese strings, including
   save/test/delete-key flows.
4. Add the static right-side panel, persistent layout state, explicit mode
   switch, input behavior, loading, cancellation, and error states.
5. Add answer-mode chat requests without document mutation.
6. Add the single-document precise-edit Agent, strict atomic block validation,
   one correction retry, explicit rewrite mode, and safe Muya/CodeMirror
   application.
7. Add persistent chat and revision journal transactions, deterministic undo,
   and Save As/rename/move identity migration.
8. Add concurrency checks, polish themes/layout, and complete validation.

Do not implement selection-aware editing, history browser, inline diff preview,
multiple providers/profiles, local models, voice input, general coding-agent
tools, or other future ideas until this v1 definition of done passes.

## 7. Tests and definition of done

### Automated tests

Cover at least:

- OpenAI and Anthropic request/response fixtures;
- redacted settings and key deletion behavior;
- HTTPS validation and request cancellation;
- answer mode never reaching mutation/revision code;
- empty/fenced/invalid model output causing no mutation;
- precise edit block parsing, unique-match validation, overlap rejection,
  atomic application, line statistics, and one correction retry;
- truncated provider responses causing no mutation;
- prepared/committed revision persistence and restart loading;
- exact deterministic undo and stale-revision refusal;
- user edits during generation, tab switching, document closing, and duplicate
  submission;
- Muya replacement producing one logical undo step;
- source-code mode dirty state and save behavior;
- precise AI marker ranges, save color transitions, range movement after user
  edits, undo/redo visibility, tab isolation, and overview/gutter navigation;
- settings/page mode behavior and i18n fallback.

### Manual and build validation

Verify on macOS, Windows, and Linux:

- ordinary MarkText open/edit/save/close/reopen remains unchanged;
- both provider formats work with a real or mocked compatible endpoint;
- answer mode never changes Markdown;
- precise edit mode applies only validated local changes and updates normal Save
  output;
- rewrite mode is explicit and applies complete Markdown only when selected;
- Ctrl+Z and the explicit undo action recover the exact prior Markdown;
- recovery survives application restart;
- stale responses cannot affect another document or overwrite human edits;
- API failure, invalid key, empty response, and cancellation leave the document
  unchanged;
- `pnpm run lint`, `pnpm run typecheck`, targeted Vitest suites, and
  `pnpm run build:unpack` pass.

Feature logs use the `[ai-editor]` prefix and never contain secrets or document
content. Focused debugging output can be collected with:

```bash
pnpm run dev 2>&1 | rg "\[ai-editor\]" > ai-editor-debug.log
```

## 8. v1 completion boundary

Stop when all of the following are true:

- MarkText's existing editor and save workflows still work;
- the right-side assistant supports explicit answer, precise-edit, and rewrite
  modes;
- one OpenAI-compatible or Anthropic-compatible HTTPS connection can be
  configured and tested;
- API keys never enter renderer state or logs;
- precise edits are generated as local patches and applied through
  Muya/CodeMirror, not filesystem writes;
- the latest AI edit is discoverable in large documents through yellow/green
  renderer markers without modifying Muya's upstream-facing core;
- every successful edit has persistent deterministic recovery;
- chat history is visible and persists per document;
- stale, cancelled, failed, or cross-document responses cannot mutate content;
- the feature works on all three desktop platforms;
- no coding-agent or repository concepts are exposed to ordinary users.
