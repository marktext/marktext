// File-mode searcher; kept as a separate file for backward compatibility with
// existing imports. Delegates to the shared IPC-backed FileSearcher exported
// from ripgrepSearcher.ts.
export { FileSearcher as default } from './ripgrepSearcher'
