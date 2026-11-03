// @vitest-environment happy-dom

import type Format from '../../../block/base/format';
import type { HardLineBreakToken } from '../../model/types';
import type Renderer from '../index';
import { describe, expect, it } from 'vitest';
import { CLASS_NAMES } from '../../../config';
import { h, toHTML } from '../../../utils/snabbdom';
import { tokenizer } from '../../lexer';
import hardLineBreak from '../hardLineBreak';
import highlight from '../highlight';
import lineBreakHighlights from '../lineBreakHighlights';

function render(source: string, active = false, search = false) {
    const tokens = tokenizer(source, { highlights: search ? [{ start: 3, end: source.length, active: true }] : [] });
    const token = tokens.find((token): token is HardLineBreakToken => token.type === 'hard_line_break')!;
    const renderer = {} as Renderer;
    renderer.highlight = highlight;
    renderer.lineBreakHighlights = lineBreakHighlights;
    renderer.getClassName = () => active ? CLASS_NAMES.MU_GRAY : CLASS_NAMES.MU_HIDE;
    renderer.getHighlightClassName = () => CLASS_NAMES.MU_HIGHLIGHT;
    const nodes = hardLineBreak.call(renderer, {
        h,
        token,
        cursor: {},
        block: { text: source } as Format,
    });
    const container = document.createElement('div');
    container.innerHTML = nodes.map(node => toHTML(node)).join('');
    return container;
}

describe('hard break markers and source offsets (#5967)', () => {
    it.each([false, true])('retains the backslash as a syntax marker (active: %j)', (active) => {
        const container = render('foo\\\nbar', active);
        const marker = container.querySelector('.mu-hard-line-break-space > .mu-remove')!;
        expect(marker.textContent).toBe('\\');
        expect(marker.classList.contains(active ? 'mu-gray' : 'mu-hide')).toBe(true);
        expect(container.textContent).toBe('\\\n');
    });

    it('keeps ignored indentation in the DOM without putting the newline inside a hidden span', () => {
        const container = render('foo\\\n     bar');
        expect(container.textContent).toBe('\\\n     ');
        expect(container.querySelector('.mu-hard-line-break')!.lastChild!.textContent).toBe('\n');
        expect(container.lastElementChild!.classList.contains('mu-hide')).toBe(true);
        expect(container.lastElementChild!.textContent).toBe('     ');
    });

    it('highlights marker, newline and indentation at their source offsets', () => {
        const container = render('foo\\\n     bar', false, true);
        expect(container.querySelector('.mu-hard-line-break-space .mu-highlight')!.textContent).toBe('\\');
        expect(container.querySelector('.mu-hard-line-break > .mu-highlight')!.textContent).toBe('');
        expect(container.lastElementChild!.querySelector('.mu-highlight')!.textContent).toBe('     ');
        expect(container.textContent).toBe('\\\n     ');
    });

    it('retains the editable blank line at the end of a live block', () => {
        const container = render('foo\\\n');
        expect(container.querySelector('.mu-line-end')!.textContent).toBe('\n');
        expect(container.textContent).toBe('\\\n');
    });

    it('keeps the existing space marker and glyph container', () => {
        const container = render('foo  \nbar');
        expect(container.querySelector('.mu-hard-line-break-space')!.textContent).toBe('  ');
        expect(container.querySelector('.mu-remove')).toBeNull();
    });
});
