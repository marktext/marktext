import { describe, it, expect } from 'vitest'
import { SyntheticHistory } from '@/components/editorWithTabs/syntheticHistory'

// Mirror of the store's PG15 dirty/clean decision (store/editor.ts): a tab is
// clean iff the current synthetic history entry id equals the saved id. We feed
// it ids produced by `SyntheticHistory` for a sequence of document contents to
// prove the saved/clean indicator is correct.
const isClean = (entryId: number, lastSavedHistoryId: number): boolean =>
  entryId === lastSavedHistoryId

describe('SyntheticHistory (saved/clean indicator id allocator)', () => {
  it('seeds the loaded/baseline content to id 0', () => {
    const h = new SyntheticHistory('A\n')
    expect(h.idFor('A\n')).toBe(0)
    expect(h.build('A\n').stack[0].id).toBe(0)
  })

  it('assigns a fresh, never-reused id to each distinct content snapshot', () => {
    const h = new SyntheticHistory('')
    const a = h.idFor('A')
    const b = h.idFor('AB')
    const c = h.idFor('ABC')
    expect(new Set([a, b, c]).size).toBe(3)
    expect(a).toBeLessThan(b)
    expect(b).toBeLessThan(c)
  })

  it('reuses the original id when an earlier snapshot is revisited (undo/redo)', () => {
    const h = new SyntheticHistory('')
    const a = h.idFor('A')
    h.idFor('AB')
    // Undo back to 'A' must reproduce 'A's original id.
    expect(h.idFor('A')).toBe(a)
  })

  // The G6 regression: type A, type B, SAVE, undo B, then a NEW divergent edit C
  // that returns the engine undo-stack to the SAVED depth. With the old
  // depth-as-id scheme the id collided with the saved id and the dirty tab
  // falsely showed clean. With content-keyed monotonic ids it stays dirty.
  it('stays dirty after undo + divergent re-edit returns to the saved depth (G6)', () => {
    const h = new SyntheticHistory('') // baseline (empty) == id 0

    h.idFor('A') // type A   -> depth 1
    const idAB = h.idFor('A\nB') // type B -> depth 2

    // SAVE at A+B: the store records this entry's id as the saved id.
    const lastSavedHistoryId = idAB

    // Undo B -> back to 'A' (depth 1): different content -> dirty.
    const idAfterUndo = h.idFor('A')
    expect(isClean(idAfterUndo, lastSavedHistoryId)).toBe(false)

    // Divergent re-edit C: the engine undo-stack returns to depth 2, but the
    // document is now A+C, NOT the saved A+B. Must be DIRTY.
    const idAfterDivergent = h.idFor('A\nC')
    expect(idAfterDivergent).not.toBe(lastSavedHistoryId)
    expect(isClean(idAfterDivergent, lastSavedHistoryId)).toBe(false)
  })

  it('undo back to the SAVED content shows clean again', () => {
    const h = new SyntheticHistory('')

    h.idFor('A')
    const idAB = h.idFor('A\nB')
    const lastSavedHistoryId = idAB

    // Undo to 'A' (dirty), then redo back to the saved A+B content (clean).
    expect(isClean(h.idFor('A'), lastSavedHistoryId)).toBe(false)
    expect(isClean(h.idFor('A\nB'), lastSavedHistoryId)).toBe(true)
  })

  it('undo back to the unsaved baseline shows clean (lastSavedHistoryId 0)', () => {
    // A freshly loaded document is its own clean baseline: the store seeds
    // `lastSavedHistoryId: 0`, and the baseline content maps to id 0.
    const h = new SyntheticHistory('hello\n')
    const lastSavedHistoryId = 0

    const idAfterEdit = h.idFor('hello world\n')
    expect(isClean(idAfterEdit, lastSavedHistoryId)).toBe(false)

    // Undo the edit back to the loaded baseline -> clean.
    expect(isClean(h.idFor('hello\n'), lastSavedHistoryId)).toBe(true)
  })

  it('tracks the saved id across save-here -> edit -> undo-to-saved', () => {
    // Save at a NON-baseline state, then verify undo-to-saved is clean and any
    // divergent content is dirty.
    const h = new SyntheticHistory('')
    h.idFor('one')
    const idSaved = h.idFor('one\ntwo') // saved here
    const lastSavedHistoryId = idSaved

    // Edit further, then undo back exactly to the saved content.
    expect(isClean(h.idFor('one\ntwo\nthree'), lastSavedHistoryId)).toBe(false)
    expect(isClean(h.idFor('one\ntwo'), lastSavedHistoryId)).toBe(true)

    // A different document that happens to reach the same undo depth is dirty.
    expect(isClean(h.idFor('one\nTWO'), lastSavedHistoryId)).toBe(false)
  })

  // The engine's markdown serialization is unstable across a setContent -> edit
  // -> undo round-trip purely in trailing newlines (loading 'x\n' may serialize
  // to 'x\n\n\n', while undoing an edit lands on 'x\n'). The id must ignore
  // trailing newlines so undo-to-saved still reads as clean.
  it('treats trailing-newline-only differences as the same content', () => {
    const h = new SyntheticHistory('hello world\n')
    const lastSavedHistoryId = 0

    // Same visible content, different trailing newlines -> still id 0 (clean).
    expect(h.idFor('hello world\n\n\n')).toBe(0)
    expect(h.idFor('hello world')).toBe(0)

    // A real content change is a fresh id (dirty)...
    expect(isClean(h.idFor('hello world EXTRA\n'), lastSavedHistoryId)).toBe(false)
    // ...and undoing it (engine lands on a different trailing-newline form of
    // the baseline) is clean again.
    expect(isClean(h.idFor('hello world\n'), lastSavedHistoryId)).toBe(true)
  })

  it('assigns distinct ids to many distinct snapshots (wide hash key)', () => {
    const h = new SyntheticHistory('')
    const ids = new Set<number>()
    for (let i = 0; i < 5000; i++) {
      ids.add(h.idFor(`line ${i}\ncontent body ${i}`))
    }
    // No collisions: every distinct content snapshot got its own id.
    expect(ids.size).toBe(5000)
  })

  it('build() emits a desktop-shaped single-entry history', () => {
    const h = new SyntheticHistory('')
    const hist = h.build('X')
    expect(hist).toMatchObject({
      index: 0,
      lastEditIndex: 0,
      lastInitIndex: -1
    })
    expect(hist.stack).toHaveLength(1)
    expect(typeof hist.stack[0].id).toBe('number')
  })
})
