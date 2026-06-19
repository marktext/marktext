// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
    computeLineCount,
    LINE_NUMBERS_ROWS_CLASS,
    lineNumbersWrapperHTML,
    repositionLineNumberSpans,
    syncLineNumbersSpans,
} from '../codeBlockLineNumbers';

// Locks the row-count semantics from marktext a028a7c2 ("feat: add code block
// line numbers"). The implementation switched to a charCode loop to avoid the
// regex match-array allocation on every code-block update; the behaviour
// (including the trailing-newline extra row) must stay identical.
describe('computeLineCount', () => {
    it('counts 1 for empty string', () => {
        expect(computeLineCount('')).toBe(1);
    });

    it('counts 1 for a single line without trailing newline', () => {
        expect(computeLineCount('hello')).toBe(1);
    });

    it('counts N for N-1 inner newlines', () => {
        expect(computeLineCount('a\nb')).toBe(2);
        expect(computeLineCount('a\nb\nc')).toBe(3);
        expect(computeLineCount('a\nb\nc\nd')).toBe(4);
    });

    it('adds one extra visible row for a trailing newline', () => {
        expect(computeLineCount('a\n')).toBe(2);
        expect(computeLineCount('a\nb\n')).toBe(3);
    });

    it('treats a lone newline as two visible rows', () => {
        expect(computeLineCount('\n')).toBe(2);
    });

    it('does not collapse consecutive blank lines', () => {
        expect(computeLineCount('a\n\nb')).toBe(3);
        expect(computeLineCount('a\n\n\nb')).toBe(4);
    });
});

describe('lineNumbersWrapperHTML', () => {
    it('emits an empty wrapper (rows are filled lazily by syncLineNumbersSpans)', () => {
        const html = lineNumbersWrapperHTML();
        expect(html).toContain(`class="${LINE_NUMBERS_ROWS_CLASS}"`);
        expect(html).toContain('contenteditable="false"');
        expect(html).toContain('aria-hidden="true"');
        expect(html).not.toContain('<span></span>');
    });

    it('uses the public class name constant', () => {
        expect(LINE_NUMBERS_ROWS_CLASS).toBe('mu-line-numbers-rows');
    });
});

describe('syncLineNumbersSpans', () => {
    let wrapper: HTMLElement;

    beforeEach(() => {
        wrapper = document.createElement('span');
    });

    it('appends N spans when starting from empty', () => {
        syncLineNumbersSpans(wrapper, 3);
        expect(wrapper.childElementCount).toBe(3);
        expect(wrapper.querySelectorAll('span').length).toBe(3);
    });

    it('is a no-op when the count already matches', () => {
        syncLineNumbersSpans(wrapper, 5);
        const before = wrapper.innerHTML;
        syncLineNumbersSpans(wrapper, 5);
        expect(wrapper.innerHTML).toBe(before);
        expect(wrapper.childElementCount).toBe(5);
    });

    it('adds only the delta when growing (does not rebuild)', () => {
        syncLineNumbersSpans(wrapper, 3);
        const firstSpan = wrapper.firstElementChild;
        syncLineNumbersSpans(wrapper, 5);
        expect(wrapper.childElementCount).toBe(5);
        // The original spans must survive — proves no full rebuild.
        expect(wrapper.firstElementChild).toBe(firstSpan);
    });

    it('removes from the tail when shrinking', () => {
        syncLineNumbersSpans(wrapper, 5);
        const firstSpan = wrapper.firstElementChild;
        syncLineNumbersSpans(wrapper, 2);
        expect(wrapper.childElementCount).toBe(2);
        expect(wrapper.firstElementChild).toBe(firstSpan);
    });

    it('handles count 0 by removing all children', () => {
        syncLineNumbersSpans(wrapper, 4);
        syncLineNumbersSpans(wrapper, 0);
        expect(wrapper.childElementCount).toBe(0);
    });
});

describe('repositionLineNumberSpans', () => {
    it('keeps the only line of an empty code block flush with the top', () => {
        const wrapper = document.createElement('span');
        syncLineNumbersSpans(wrapper, 1);
        // An empty code element has no text nodes to measure from.
        const codeEl = document.createElement('code');

        repositionLineNumberSpans(wrapper, codeEl);

        expect((wrapper.children[0] as HTMLElement).style.top).toBe('0px');
    });

    it('anchors line numbers to the first line so the line-box leading cancels', () => {
        const wrapper = document.createElement('span');
        syncLineNumbersSpans(wrapper, 3);
        const codeEl = document.createElement('code');
        codeEl.appendChild(document.createTextNode('a\nb\nc'));

        // happy-dom performs no layout. Emulate three stacked lines whose
        // measured tops carry a constant line-box leading offset (110, 140,
        // 170). The gutter must use the first line as its origin — not the
        // wrapper rect — so that leading cancels and line 1 sits at 0px.
        const tops = [110, 140, 170];
        let call = 0;
        const rangeProto = Range.prototype as unknown as {
            getBoundingClientRect: () => { top: number };
        };
        const origRangeRect = rangeProto.getBoundingClientRect;
        rangeProto.getBoundingClientRect = () => ({ top: tops[call++] });
        // The wrapper's own rect must no longer influence the result.
        (wrapper as unknown as { getBoundingClientRect: () => { top: number } })
            .getBoundingClientRect = () => ({ top: 999 });

        try {
            repositionLineNumberSpans(wrapper, codeEl);
        }
        finally {
            rangeProto.getBoundingClientRect = origRangeRect;
        }

        expect((wrapper.children[0] as HTMLElement).style.top).toBe('0px');
        expect((wrapper.children[1] as HTMLElement).style.top).toBe('30px');
        expect((wrapper.children[2] as HTMLElement).style.top).toBe('60px');
    });
});
