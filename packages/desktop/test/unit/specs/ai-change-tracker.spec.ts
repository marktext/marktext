import { describe, expect, it } from 'vitest'
import { AiChangeTracker, rangesFromSummary, fullDocumentRange } from '@/store/aiChangeTracker'

describe('AI change tracker', () => {
  it('tracks exact output ranges and shifts them when text is inserted before them', () => {
    const tracker = new AiChangeTracker()
    const after = 'first\nnew second\nthird'
    const summary = {
      operationCount: 1,
      addedLines: 1,
      removedLines: 1,
      operations: [{
        startLine: 2,
        endLine: 2,
        addedLines: 1,
        removedLines: 1,
        afterStartLine: 2,
        afterEndLine: 2,
        afterStartOffset: 6,
        afterEndOffset: 16
      }]
    }
    const ranges = rangesFromSummary(after, summary)
    tracker.apply('tab', 'revision', 'first\nsecond\nthird', after, ranges)

    tracker.updateDocument('tab', 'prefix\nfirst\nnew second\nthird')
    expect(tracker.get('tab')?.ranges[0]).toMatchObject({
      startLine: 3,
      endLine: 3,
      startOffset: 13,
      endOffset: 23
    })
  })

  it('changes status on save and hides/restores a marker across undo and redo', () => {
    const tracker = new AiChangeTracker()
    tracker.apply('tab', 'revision', 'before', 'after', fullDocumentRange('after'))
    expect(tracker.get('tab')).toMatchObject({ status: 'unsaved', visible: true })

    tracker.markSaved('tab')
    expect(tracker.get('tab')).toMatchObject({ status: 'saved', visible: true })

    tracker.updateDocument('tab', 'before')
    expect(tracker.get('tab')).toMatchObject({ visible: false })
    tracker.updateDocument('tab', 'before plus human edit')
    expect(tracker.get('tab')).toMatchObject({ visible: false })
    tracker.updateDocument('tab', 'after')
    expect(tracker.get('tab')).toMatchObject({ status: 'saved', visible: true })
  })

  it('replaces the previous AI revision and clears it explicitly', () => {
    const tracker = new AiChangeTracker()
    tracker.apply('tab', 'first', 'a', 'b', fullDocumentRange('b'))
    tracker.apply('tab', 'second', 'b', 'c', fullDocumentRange('c'))
    expect(tracker.get('tab')?.revisionId).toBe('second')
    tracker.clear('tab')
    expect(tracker.get('tab')).toBeUndefined()
  })
})
