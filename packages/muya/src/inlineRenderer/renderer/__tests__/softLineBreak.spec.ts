// @vitest-environment happy-dom

import type { SoftLineBreakToken } from '../../types';
import type Renderer from '../index';
import { describe, expect, it } from 'vitest';
import { CLASS_NAMES } from '../../../config';
import { h } from '../../../utils/snabbdom';
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
    return obj as unknown as Renderer;
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
            muya: { options: { softNewlineAsSpace: false } },
        });
        const token = makeToken();
        const out = softLineBreak.call(
            renderer,
            { h, token } as Parameters<typeof softLineBreak>[1],
        );

        expect(getSelector(out)).toBe(`span.${CLASS_NAMES.MU_SOFT_LINE_BREAK}`);
        expect(getContent(out)).toBe('\n');
    });

    it('emits \\n content (not a space) with MU_SOFT_NEWLINE_AS_SPACE class when option is on', () => {
        const renderer = asRenderer({
            muya: { options: { softNewlineAsSpace: true } },
        });
        const token = makeToken();
        const out = softLineBreak.call(
            renderer,
            { h, token } as Parameters<typeof softLineBreak>[1],
        );

        expect(getSelector(out)).toContain(CLASS_NAMES.MU_SOFT_NEWLINE_AS_SPACE);
        expect(getSelector(out)).toContain(CLASS_NAMES.MU_SOFT_LINE_BREAK);
        expect(getContent(out)).toBe('\n');
    });

    it('does not add MU_LINE_END when softNewlineAsSpace is on, even if isAtEnd is true', () => {
        const renderer = asRenderer({
            muya: { options: { softNewlineAsSpace: true } },
        });
        const token = makeToken({ isAtEnd: true });
        const out = softLineBreak.call(
            renderer,
            { h, token } as Parameters<typeof softLineBreak>[1],
        );

        expect(getSelector(out)).not.toContain(CLASS_NAMES.MU_LINE_END);
        expect(getSelector(out)).toContain(CLASS_NAMES.MU_SOFT_NEWLINE_AS_SPACE);
    });

    it('adds MU_LINE_END when isAtEnd is true and softNewlineAsSpace is off', () => {
        const renderer = asRenderer({
            muya: { options: { softNewlineAsSpace: false } },
        });
        const token = makeToken({ isAtEnd: true });
        const out = softLineBreak.call(
            renderer,
            { h, token } as Parameters<typeof softLineBreak>[1],
        );

        expect(getSelector(out)).toContain(CLASS_NAMES.MU_LINE_END);
    });
});
