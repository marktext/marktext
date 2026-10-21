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
    expect(h.idFor('A')).toBe(a)
  })

  // The G6 regression: type A, type B, SAVE, undo B, then a NEW divergent edit C
  // that returns the engine undo-stack to the SAVED depth. With the old
  // depth-as-id scheme the id collided with the saved id and the dirty tab
  // falsely showed clean. With content-keyed monotonic ids it stays dirty.
  it('stays dirty after undo + divergent re-edit returns to the saved depth (G6)', () => {
    const h = new SyntheticHistory('')

    h.idFor('A') // type A   -> depth 1
    const idAB = h.idFor('A\nB') // type B -> depth 2

    const lastSavedHistoryId = idAB

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

    expect(isClean(h.idFor('A'), lastSavedHistoryId)).toBe(false)
    expect(isClean(h.idFor('A\nB'), lastSavedHistoryId)).toBe(true)
  })

  it('undo back to the unsaved baseline shows clean (lastSavedHistoryId 0)', () => {
    const h = new SyntheticHistory('hello\n')
    const lastSavedHistoryId = 0

    const idAfterEdit = h.idFor('hello world\n')
    expect(isClean(idAfterEdit, lastSavedHistoryId)).toBe(false)

    expect(isClean(h.idFor('hello\n'), lastSavedHistoryId)).toBe(true)
  })

  it('tracks the saved id across save-here -> edit -> undo-to-saved', () => {
    // Save at a NON-baseline state, then verify undo-to-saved is clean and any
    // divergent content is dirty.
    const h = new SyntheticHistory('')
    h.idFor('one')
    const idSaved = h.idFor('one\ntwo')
    const lastSavedHistoryId = idSaved

    expect(isClean(h.idFor('one\ntwo\nthree'), lastSavedHistoryId)).toBe(false)
    expect(isClean(h.idFor('one\ntwo'), lastSavedHistoryId)).toBe(true)

    expect(isClean(h.idFor('one\nTWO'), lastSavedHistoryId)).toBe(false)
  })

  // The engine's markdown serialization is unstable across a setContent -> edit
  // -> undo round-trip purely in trailing newlines (loading 'x\n' may serialize
  // to 'x\n\n\n', while undoing an edit lands on 'x\n'). The id must ignore
  // trailing newlines so undo-to-saved still reads as clean.
  it('treats trailing-newline-only differences as the same content', () => {
    const h = new SyntheticHistory('hello world\n')
    const lastSavedHistoryId = 0

    expect(h.idFor('hello world\n\n\n')).toBe(0)
    expect(h.idFor('hello world')).toBe(0)

    expect(isClean(h.idFor('hello world EXTRA\n'), lastSavedHistoryId)).toBe(false)
    expect(isClean(h.idFor('hello world\n'), lastSavedHistoryId)).toBe(true)
  })

  it('assigns distinct ids to many distinct snapshots (wide hash key)', () => {
    const h = new SyntheticHistory('')
    const ids = new Set<number>()
    for (let i = 0; i < 5000; i++) {
      ids.add(h.idFor(`line ${i}\ncontent body ${i}`))
    }
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
