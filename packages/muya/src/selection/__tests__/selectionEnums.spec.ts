import { describe, expect, it } from 'vitest';
import { SelectionCaretType, SelectionDirection } from '../types';

describe('selection enums', () => {
    it('keep wire-compatible string values', () => {
        expect(SelectionDirection.FORWARD).toBe('forward');
        expect(SelectionDirection.BACKWARD).toBe('backward');
        expect(SelectionDirection.NONE).toBe('none');
        expect(SelectionCaretType.CARET).toBe('Caret');
        expect(SelectionCaretType.RANGE).toBe('Range');
        expect(SelectionCaretType.NONE).toBe('None');
    });
});
