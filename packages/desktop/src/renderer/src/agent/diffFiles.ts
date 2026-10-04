import { parse } from 'diff2html'

export interface DiffEntry {
  path: string
  kind: 'A' | 'M' | 'D' | 'R'
  added: number
  deleted: number
}

interface ParsedDiffFile {
  oldName: string
  newName: string
  addedLines: number
  deletedLines: number
  isDeleted?: boolean
  isNew?: boolean
  isRename?: boolean
  isCopy?: boolean
}

/** diff2html leaves `/dev/null` on the side git did not write. */
const displayPath = (file: ParsedDiffFile): string => {
  if (file.isDeleted || file.newName === '/dev/null') return file.oldName
  return file.newName
}

const kindOf = (file: ParsedDiffFile): DiffEntry['kind'] => {
  if (file.isDeleted) return 'D'
  if (file.isNew) return 'A'
  if (file.isRename || file.isCopy) return 'R'
  return 'M'
}

export const entriesFromPatch = (patch: string): DiffEntry[] => {
  if (patch.trim().length === 0) return []
  return parse(patch).map((file) => ({
    path: displayPath(file),
    kind: kindOf(file),
    added: file.addedLines,
    deleted: file.deletedLines
  }))
}
