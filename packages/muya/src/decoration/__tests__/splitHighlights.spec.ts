import { describe, expect, it } from 'vitest';
import { CLASS_NAMES } from '../../config';
import { splitHighlightRanges } from '../splitHighlights';

describe('splitHighlightRanges', () => {
    it('leaves a single range untouched', () => {
        const light = { start: 1, end: 4, active: true };

        expect(splitHighlightRanges([light])).toEqual([light]);
    });

    it('keeps adjacent ranges as separate spans', () => {
        const ranges = splitHighlightRanges([
            { start: 0, end: 3, active: false },
            { start: 3, end: 6, active: true },
        ]);

        expect(ranges).toEqual([
            { start: 0, end: 3, active: false },
            { start: 3, end: 6, active: true },
        ]);
    });

    it('cuts an overlap into a search span, a combined span, and a comment span', () => {
        const ranges = splitHighlightRanges([
            { start: 0, end: 5, active: true },
            {
                start: 2,
                end: 8,
                active: true,
                className: CLASS_NAMES.MU_COMMENT,
                dataId: 'c1',
            },
        ]);

        expect(ranges).toEqual([
            { start: 0, end: 2, active: true },
            {
                start: 2,
                end: 5,
                active: true,
                className: `${CLASS_NAMES.MU_HIGHLIGHT} ${CLASS_NAMES.MU_COMMENT}`,
                dataId: 'c1',
            },
            {
                start: 5,
                end: 8,
                active: true,
                className: CLASS_NAMES.MU_COMMENT,
                dataId: 'c1',
            },
        ]);
    });
});
