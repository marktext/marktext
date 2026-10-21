// Save tracking uses content IDs because engine undo depth is reused for divergent edits.
// Each distinct document gets a fresh ID; revisiting saved content restores its saved ID.
// The store consumes a single-entry history containing that ID, separately from engine undo.

// Ignore trailing newlines: save normalizes them and engine round-trips may change them
// without an edit, which would otherwise prevent undo-to-saved from reading as clean.
const stripTrailingNewlines = (content: string): string =>
  content.replace(/[\r\n]+$/, '')

// Use compact 64-bit content keys instead of retaining every document snapshot.
// The wider hash reduces collisions that could incorrectly mark divergent content clean.
const FNV64_OFFSET = 0xcbf29ce484222325n
const FNV64_PRIME = 0x100000001b3n
const MASK64 = 0xffffffffffffffffn
const hashContent = (content: string): bigint => {
  const normalized = stripTrailingNewlines(content)
  let hash = FNV64_OFFSET
  for (let i = 0; i < normalized.length; i++) {
    hash ^= BigInt(normalized.charCodeAt(i))
    hash = (hash * FNV64_PRIME) & MASK64
  }
  return hash
}

export interface IFileHistoryLike {
  stack: Array<{ id: number | string; [key: string]: unknown }>
  index: number
  lastEditIndex: number
  lastInitIndex: number
}

// Per-tab content IDs; reset baseline to ID 0 after setContent clears engine history.
export class SyntheticHistory {
  private counter = 0
  private readonly idByContent = new Map<bigint, number>()

  constructor(baselineContent: string = '') {
    this.idByContent.set(hashContent(baselineContent), 0)
  }

  // Revisiting content reuses its original ID, including after undo or redo.
  idFor(content: string): number {
    const key = hashContent(content)
    let id = this.idByContent.get(key)
    if (id === undefined) {
      id = ++this.counter
      this.idByContent.set(key, id)
    }
    return id
  }

  // Only stack[lastEditIndex].id is read for save tracking; other fields preserve its contract.
  build(content: string): IFileHistoryLike {
    return {
      stack: [{ id: this.idFor(content) }],
      index: 0,
      lastEditIndex: 0,
      lastInitIndex: -1
    }
  }
}
