import { describe, expect, it } from 'vitest';
import { classifyInputKind, shouldBreakUndoGroup } from '../index';

// Undo grouping is otherwise time-based only (History.delay = 1s), so a fast
// typed sentence coalesces into a single undo entry (#3825). These helpers
// drive the boundary decision the input pipeline feeds to History.cutoff().

describe('classifyInputKind', () => {
    it('classifies insertion input types as "insert"', () => {
        expect(classifyInputKind('insertText')).toBe('insert');
        expect(classifyInputKind('insertFromPaste')).toBe('insert');
        expect(classifyInputKind('insertReplacementText')).toBe('insert');
    });

    it('classifies deletion input types as "delete"', () => {
        expect(classifyInputKind('deleteContentBackward')).toBe('delete');
        expect(classifyInputKind('deleteContentForward')).toBe('delete');
        expect(classifyInputKind('deleteByCut')).toBe('delete');
    });

    it('returns null for non insert/delete input types', () => {
        expect(classifyInputKind('formatBold')).toBeNull();
        expect(classifyInputKind('historyUndo')).toBeNull();
        expect(classifyInputKind('')).toBeNull();
    });
});

describe('shouldBreakUndoGroup', () => {
    it('does not break while typing non-whitespace characters', () => {
        expect(shouldBreakUndoGroup('insert', 'insert', 'a')).toBe(false);
        expect(shouldBreakUndoGroup(null, 'insert', 'h')).toBe(false);
    });

    it('breaks on a typed whitespace (word boundary)', () => {
        expect(shouldBreakUndoGroup('insert', 'insert', ' ')).toBe(true);
        expect(shouldBreakUndoGroup('insert', 'insert', '\t')).toBe(true);
    });

    it('breaks when switching between inserting and deleting', () => {
        expect(shouldBreakUndoGroup('insert', 'delete', null)).toBe(true);
        expect(shouldBreakUndoGroup('delete', 'insert', 'a')).toBe(true);
    });

    it('does not break for consecutive deletions', () => {
        expect(shouldBreakUndoGroup('delete', 'delete', null)).toBe(false);
    });

    it('never breaks when the new kind is unknown', () => {
        expect(shouldBreakUndoGroup('insert', null, null)).toBe(false);
    });
});
