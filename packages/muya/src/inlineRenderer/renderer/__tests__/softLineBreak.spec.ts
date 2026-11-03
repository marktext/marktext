// @vitest-environment happy-dom

import type Format from '../../../block/base/format';
import type { SoftLineBreakToken } from '../../model/types';
import type Renderer from '../index';
import { describe, expect, it } from 'vitest';
import { CLASS_NAMES } from '../../../config';
import { h, toHTML } from '../../../utils/snabbdom';
import { tokenizer } from '../../lexer';
import highlight from '../highlight';
import lineBreakHighlights from '../lineBreakHighlights';
import softLineBreak from '../softLineBreak';

function makeToken(overrides: Partial<SoftLineBreakToken> = {}): SoftLineBreakToken {
    return {
        type: 'soft_line_break',
        raw: '\n',
        lineBreak: '\n',
        isAtEnd: false,
        parent: [],
        range: { start: 0, end: 1 },
        ...overrides,
    };
}

function asRenderer(obj: object): Renderer {
    return { lineBreakHighlights, ...obj } as unknown as Renderer;
}

function getSelector(vnodes: ReturnType<typeof softLineBreak>): string {
    return vnodes[0].sel as string;
}

function getContent(vnodes: ReturnType<typeof softLineBreak>): string {
    const node = vnodes[0];
    return typeof node.children === 'string'
        ? node.children
        : (node.text as string);
}

describe('softLineBreak renderer — softNewlineAsSpace', () => {
    it('emits \\n content and MU_SOFT_LINE_BREAK class by default', () => {
        const renderer = asRenderer({
            environment: { softNewlineAsSpace: false },
        });
        const token = makeToken();
        const out = softLineBreak.call(
            renderer,
            { h, token } as Parameters<typeof softLineBreak>[0],
        );

        expect(getSelector(out)).toBe(`span.${CLASS_NAMES.MU_SOFT_LINE_BREAK}`);
        expect(getContent(out)).toBe('\n');
    });

    it('emits \\n content (not a space) with MU_SOFT_NEWLINE_AS_SPACE class when option is on', () => {
        const renderer = asRenderer({
            environment: { softNewlineAsSpace: true },
        });
        const token = makeToken();
        const out = softLineBreak.call(
            renderer,
            { h, token } as Parameters<typeof softLineBreak>[0],
        );

        expect(getSelector(out)).toContain(CLASS_NAMES.MU_SOFT_NEWLINE_AS_SPACE);
        expect(getSelector(out)).toContain(CLASS_NAMES.MU_SOFT_LINE_BREAK);
        expect(getContent(out)).toBe('\n');
    });

    it('does not add MU_LINE_END when softNewlineAsSpace is on, even if isAtEnd is true', () => {
        const renderer = asRenderer({
            environment: { softNewlineAsSpace: true },
        });
        const token = makeToken({ isAtEnd: true });
        const out = softLineBreak.call(
            renderer,
            { h, token } as Parameters<typeof softLineBreak>[0],
        );

        expect(getSelector(out)).not.toContain(CLASS_NAMES.MU_LINE_END);
        expect(getSelector(out)).toContain(CLASS_NAMES.MU_SOFT_NEWLINE_AS_SPACE);
    });

    it('adds MU_LINE_END when isAtEnd is true and softNewlineAsSpace is off', () => {
        const renderer = asRenderer({
            environment: { softNewlineAsSpace: false },
        });
        const token = makeToken({ isAtEnd: true });
        const out = softLineBreak.call(
            renderer,
            { h, token } as Parameters<typeof softLineBreak>[0],
        );

        expect(getSelector(out)).toContain(CLASS_NAMES.MU_LINE_END);
    });

    it('renders an empty highlight band before the raw \\n when the token is matched', () => {
        const renderer = asRenderer({
            environment: { softNewlineAsSpace: false },
            getHighlightClassName: (active: boolean) =>
                active ? CLASS_NAMES.MU_HIGHLIGHT : CLASS_NAMES.MU_SELECTION,
        });
        const token = makeToken({
            highlights: [{ start: 0, end: 1, active: true }],
        });
        const out = softLineBreak.call(
            renderer,
            { h, token } as Parameters<typeof softLineBreak>[0],
        );

        const children = out[0].children as Array<{ sel?: string; text?: string }>;
        expect((children[0] as { sel: string }).sel).toBe(`span.${CLASS_NAMES.MU_HIGHLIGHT}`);
        expect(children[0].text).toBeUndefined();
        expect(children[1].text).toBe('\n');
    });
});

describe('soft break whitespace and source offsets (#5981)', () => {
    it.each([false, true])('retains ignored whitespace and search highlights (active: %j)', (active) => {
        const source = 'foo \n \tbar';
        const token = tokenizer(source, { highlights: [{ start: 3, end: 7, active: true }] })[1];
        expect(token.type).toBe('soft_line_break');
        if (token.type !== 'soft_line_break')
            throw new Error('Expected a soft break');
        const renderer = asRenderer({
            environment: { softNewlineAsSpace: false },
            getClassName: () => active ? CLASS_NAMES.MU_GRAY : CLASS_NAMES.MU_HIDE,
            getHighlightClassName: () => CLASS_NAMES.MU_HIGHLIGHT,
            highlight,
        });
        const nodes = softLineBreak.call(renderer, { h, token, cursor: {}, block: { text: source } as Format });
        const container = document.createElement('div');
        container.innerHTML = nodes.map(node => toHTML(node)).join('');
        expect(container.textContent).toBe(' \n \t');
        expect(container.querySelector('.mu-soft-line-break')!.textContent).toBe('\n');
        expect(Array.from(container.querySelectorAll('.mu-remove')).map(node => node.textContent)).toEqual([' ', ' \t']);
        expect(container.querySelectorAll(active ? '.mu-gray' : '.mu-hide')).toHaveLength(2);
        expect(Array.from(container.querySelectorAll('.mu-highlight')).map(node => node.textContent)).toEqual([' ', '', ' \t']);
    });
});
