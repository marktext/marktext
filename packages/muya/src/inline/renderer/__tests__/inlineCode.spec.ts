// @vitest-environment happy-dom

import type Format from '../../../block/base/format';
import type Renderer from '../index';
import { describe, expect, it } from 'vitest';
import { CLASS_NAMES } from '../../../config';
import { h, toHTML } from '../../../utils/snabbdom';
import { tokenizer } from '../../lexer';
import highlight from '../highlight';
import inlineCode from '../inlineCode';

function render(source: string, active = false) {
    const token = tokenizer(source, {
        profile: 'inline',
        highlights: [{ start: 0, end: source.length, active: true }],
    })[0];
    if (token.type !== 'inline_code')
        throw new Error('Expected an inline code token');
    const renderer = {} as Renderer;
    renderer.highlight = highlight;
    renderer.getClassName = () => active ? CLASS_NAMES.MU_GRAY : CLASS_NAMES.MU_HIDE;
    renderer.getHighlightClassName = () => CLASS_NAMES.MU_HIGHLIGHT;
    const nodes = inlineCode.call(renderer, {
        h,
        token,
        cursor: {},
        block: { text: source } as Format,
    });
    const container = document.createElement('div');
    container.innerHTML = nodes.map(node => toHTML(node)).join('');
    return container;
}

describe('inline code source and display whitespace', () => {
    it.each([false, true])('preserves source and search ranges (active: %j)', (active) => {
        const source = '``\r\nfoo\nbar  \nbaz\r\n``';
        const container = render(source, active);
        expect(container.textContent).toBe(source);
        expect([...container.querySelectorAll('.mu-highlight')].map(node => node.textContent).join('')).toBe(source);
        const code = container.querySelector('code')!;
        expect(container.firstElementChild!.classList.contains(active ? 'mu-gray' : 'mu-hide')).toBe(true);
        expect(container.firstElementChild!.textContent).toBe('``\r\n');
        expect(container.lastElementChild!.textContent).toBe('\r\n``');
        expect(code.querySelectorAll('.mu-soft-newline-as-space')).toHaveLength(active ? 0 : 2);
    });

    it.each(['`  `', '`\u00A0`', '`\t`'])('keeps all-space and non-ASCII whitespace visible in %j', (source) => {
        const code = render(source).querySelector('code')!;
        expect(code.querySelector('.mu-hide')).toBeNull();
        expect(code.textContent).toBe(source.slice(1, -1));
    });
});
