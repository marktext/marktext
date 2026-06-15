import { describe, expect, it } from 'vitest';
import { SelectionCaretType, SelectionDirection } from '../types';

describe('selection enums', () => {
    it('keep wire-compatible string values', () => {
        expect(SelectionDirection.Forward).toBe('forward');
        expect(SelectionDirection.Backward).toBe('backward');
        expect(SelectionDirection.None).toBe('none');
        expect(SelectionCaretType.Caret).toBe('Caret');
        expect(SelectionCaretType.Range).toBe('Range');
        expect(SelectionCaretType.None).toBe('None');
    });
});
