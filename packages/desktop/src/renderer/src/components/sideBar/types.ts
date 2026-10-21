// Sidebar payloads share the project store, search and editor contracts.

import type { IFileState } from '@shared/types/files'


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

export type TreeNode = TreeFolderNode


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


export type TabDescriptor = IFileState
