import type { ISerializedHistory, IHeadingFoldState } from '@muyajs/core'
import CodeMirror from 'codemirror'
import type { TabHistorySnapshots } from '@shared/types/tabTransfer'
import { sourceHistory } from './documentMode'

export const engineHistoryByTab = new Map<string, ISerializedHistory>()
export const headingFoldsByTab = new Map<string, { markdown: string; folds: IHeadingFoldState[] }>()

export const portableHistoryByTab = new Map<string, TabHistorySnapshots>()
let renderedCapture: ((id: string, markdown: string) => TabHistorySnapshots) | null = null
export const registerRenderedHistoryCapture = (capture: typeof renderedCapture): void => {
  renderedCapture = capture
}

/** Snapshots bridge undo boundaries when the destination uses a different editor engine. */
export const capturePortableHistory = (
  id: string,
  markdown: string,
  source: boolean
): TabHistorySnapshots => {
  if (!source) return renderedCapture?.(id, markdown) ?? { undo: [], redo: [] }
  const cached = sourceHistory.get(id)
  if (!cached) return { undo: [], redo: [] }
  const doc = new CodeMirror.Doc(cached.markdown)
  doc.setHistory(cached.history as ReturnType<typeof doc.getHistory>)
  const result: TabHistorySnapshots = { undo: [], redo: [] }
  const { undo, redo } = doc.historySize()
  for (let i = 0; i < undo; i++) {
    doc.undo()
    result.undo.push(doc.getValue())
  }
  doc.setValue(cached.markdown)
  doc.setHistory(cached.history as ReturnType<typeof doc.getHistory>)
  for (let i = 0; i < redo; i++) {
    doc.redo()
    result.redo.push(doc.getValue())
  }
  return result
}

export const sourceHistoryFromSnapshots = (
  markdown: string,
  snapshots: TabHistorySnapshots
): NonNullable<ReturnType<typeof sourceHistory.get>> => {
  const states = [...snapshots.undo].reverse()
  const doc = new CodeMirror.Doc(states.shift() ?? markdown)
  doc.clearHistory()
  for (const text of [...states, markdown, ...snapshots.redo]) {
    if (doc.getValue() !== text) {
      doc.changeGeneration(true)
      doc.setValue(text)
    }
  }
  for (let i = 0; i < snapshots.redo.length; i++) doc.undo()
  return { markdown, canonicalMarkdown: markdown, history: doc.getHistory() }
}
