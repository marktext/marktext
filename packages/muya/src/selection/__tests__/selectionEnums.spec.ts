import { describe, expect, it } from 'vitest';
import { SelectionDirection, SelectionType } from '../types';

describe('selection enums', () => {
    it('use stable discriminants', () => {
        expect(SelectionDirection.FORWARD).toBe('forward');
        expect(SelectionDirection.BACKWARD).toBe('backward');
        expect(SelectionDirection.NONE).toBe('none');
        expect(SelectionType.TEXT).toBe('text');
        expect(SelectionType.TABLE).toBe('table');
        expect(SelectionType.IMAGE).toBe('image');
    });
});
