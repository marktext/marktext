// @vitest-environment happy-dom

import type Format from '../../../block/base/format';
import type { TextToken } from '../../model/types';
import type Renderer from '../index';
import { expect, it } from 'vitest';
import { CLASS_NAMES } from '../../../config';
import { h, toHTML } from '../../../utils/snabbdom';
import { tokenizer } from '../../lexer';
import highlight from '../highlight';
import text from '../text';

it.each([false, true])('preserves editable trailing whitespace and search offsets (active: %j)', (active) => {
    const source = 'foo\t  ';
    const token = tokenizer(source, { highlights: [{ start: 2, end: source.length, active: true }] })[0] as TextToken;
    const renderer = {} as Renderer;
    renderer.highlight = highlight;
    renderer.getClassName = () => active ? CLASS_NAMES.MU_GRAY : CLASS_NAMES.MU_HIDE;
    renderer.getHighlightClassName = () => CLASS_NAMES.MU_HIGHLIGHT;
    const nodes = text.call(renderer, { h, token, cursor: {}, block: { text: source } as Format });
    const container = document.createElement('div');
    container.innerHTML = nodes.map(node => toHTML(node)).join('');
    expect(container.textContent).toBe(source);
    expect(container.querySelector('.mu-plain-text')!.textContent).toBe('foo');
    const whitespace = container.querySelector('.mu-remove')!;
    expect(whitespace.textContent).toBe('\t  ');
    expect(whitespace.classList.contains(active ? 'mu-gray' : 'mu-hide')).toBe(true);
    expect([...container.querySelectorAll('.mu-highlight')].map(node => node.textContent).join('')).toBe(source.slice(2));
});
