
import type { BufferedRoot } from './project'
import type { IFileState } from './files'

export interface BufferedEditorState {
  tabs: IFileState[]
  currentFileId?: string
  [key: string]: unknown
}

export interface BufferedProjectState {
  roots?: BufferedRoot[]
  rootDirectory?: string
  [key: string]: unknown
}

export interface BufferedLayoutState {
  [key: string]: unknown
}

export interface BufferedState {
  editor?: BufferedEditorState
  project?: BufferedProjectState
  layout?: BufferedLayoutState
  [key: string]: unknown
}
