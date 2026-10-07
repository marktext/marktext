// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';
import { getHighlightHtml } from '../../utils/marked/getHighlightHtml';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

function toState(md: string, multilineBlockquote: boolean) {
    return new MarkdownToState({
        footnote: false,
        texMathDollars: true,
        texMathGfm: false,
        texMathSingleBackslash: false,
        texMathDoubleBackslash: false,
        trimUnnecessaryCodeBlockEmptyLines: false,
        frontMatter: true,
        multilineBlockquote,
    }).generate(md);
}

function roundTrip(md: string): string {
    return new ExportMarkdown({ listIndentation: 1 }).generate(toState(md, true));
}

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
});

function bootMuya(markdown: string, multilineBlockquote: boolean): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, multilineBlockquote } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

describe('multiline blockquote — parse and serialize', () => {
    const MD = '>>>\nline one\n\nline two\n>>>\n';

    it('parses a `>>>` fence into a fenced block-quote state', () => {
        const states = toState(MD, true);

        expect(states).toHaveLength(1);
        expect(states[0].name).toBe('block-quote');
        expect(states[0]).toMatchObject({ meta: { style: 'fenced' } });
        expect((states[0] as { children: unknown[] }).children).toHaveLength(2);
    });

    it('round-trips the fence verbatim', () => {
        expect(roundTrip(MD)).toBe(MD);
    });

    it('keeps nested block content inside the fence', () => {
        const md = '>>>\n- a\n- b\n>>>\n';
        expect(roundTrip(md)).toBe(md);
    });

    it('classifies nested ordered and task lists inside the fence', () => {
        const ordered = '>>>\n1. a\n2. b\n>>>\n';
        const task = '>>>\n- [x] done\n- [ ] todo\n>>>\n';
        expect(roundTrip(ordered)).toBe(ordered);
        expect(roundTrip(task)).toBe(task);
    });

    it('keeps the fence as literal text when the option is off', () => {
        const states = toState(MD, false);
        expect(states).toHaveLength(1);
        expect(states[0]).toMatchObject({ name: 'paragraph', text: '>>>\nline one\n\nline two\n>>>' });
        expect(new ExportMarkdown({ listIndentation: 1 }).generate(states)).toBe(MD);
    });

    it('recognises a fence on an off → on live toggle', () => {
        // Loaded with the preference off, the fence survives as literal text…
        const off = bootMuya(MD, false);
        expect(off.getMarkdown()).toBe(MD);

        // …so flipping it on re-parses that text into a fenced block-quote.
        off.setOptions({ multilineBlockquote: true }, true);
        expect(off.getState()[0].name).toBe('block-quote');
        expect(off.getMarkdown()).toBe(MD);
    });

    it('preserves the fence through an editor round-trip', () => {
        const muya = bootMuya(MD, true);
        expect(muya.getMarkdown()).toBe(MD);
    });
});

describe('multiline blockquote — HTML export', () => {
    const MD = '>>>\nline one\n\nline two\n>>>\n';

    it('renders a fenced quote as a single <blockquote> when enabled', () => {
        expect(getHighlightHtml(MD, { multilineBlockquote: true })).toBe(
            '<blockquote>\n<p>line one</p>\n<p>line two</p>\n</blockquote>\n',
        );
    });

    it('keeps the fence literal when disabled', () => {
        expect(getHighlightHtml(MD, { multilineBlockquote: false })).toBe(
            '<p>&gt;&gt;&gt;\nline one\n\nline two\n&gt;&gt;&gt;</p>\n',
        );
    });
});
