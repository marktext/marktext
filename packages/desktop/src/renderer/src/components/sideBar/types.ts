// Shared shapes for the sideBar component group.
//
// These types are intentionally narrow approximations of the runtime payloads
// produced by the project store (treeCtrl mutations), the ripgrep searcher,
// and the editor TOC builder. They cover the renderer surfaces touched by the
// sideBar SFCs; deeper invariants live alongside the producers.

import type { IFileState } from '@shared/types/files'

// ---------------------------------------------------------------------------
// File tree (sideBar/tree.vue, treeFile.vue, treeFolder.vue, project store)
// ---------------------------------------------------------------------------

export interface TreeFileNode {
  id?: string
  pathname: string
  name: string
  birthTime?: number | Date
  isDirectory: false
  isFile: true
  isMarkdown: boolean
}

export interface TreeFolderNode {
  id?: string
  pathname: string
  name: string
  isCollapsed?: boolean
  isDirectory: true
  isFile: false
  isMarkdown: false
  folders: TreeFolderNode[]
  files: TreeFileNode[]
}

// The root project tree — same shape as TreeFolderNode in practice, exposed
// under a friendlier alias so SFCs can spell their intent.
export type TreeNode = TreeFolderNode

// ---------------------------------------------------------------------------
// Search (sideBar/search.vue, searchResultItem.vue)
// ---------------------------------------------------------------------------

// Range tuple emitted by the ripgrep bridge: [[startLine, startCh], [endLine, endCh]]
export type SearchRange = [[number, number], [number, number]]

export interface SearchMatch {
  lineText: string
  range: SearchRange
}

export interface SearchResult {
  filePath: string
  matches: SearchMatch[]
}

// ---------------------------------------------------------------------------
// Tab descriptor (sideBar/treeOpenedTab.vue)
// ---------------------------------------------------------------------------

// The sideBar consumes the same per-tab state shape as the editor store.
export type TabDescriptor = IFileState
