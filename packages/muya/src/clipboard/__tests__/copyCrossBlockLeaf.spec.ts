// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type { Muya } from '../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';

// Cross-block copy with a leaf-block endpoint (heading / code-block):
//  - an atx heading's `# ` marker rides along in the selected text and is
//    dropped only when the selection starts past it (paragraph either way);
//  - a code-block endpoint keeps its fence + language and truncates its body
//    to the caret instead of dumping the whole block.

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => Promise.resolve([]),
    search: () => [],
}));

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new MuyaClass(host, { markdown } as ConstructorParameters<typeof MuyaClass>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function stub(muya: Muya, ab: Content, ao: number, fb: Content, fo: number) {
    muya.editor.selection.getSelection = () => ({
        anchor: { offset: ao, block: ab, path: ab.path },
        focus: { offset: fo, block: fb, path: fb.path },
        isCollapsed: false,
        isSelectionInSameBlock: false,
        direction: SelectionDirection.FORWARD,
        type: SelectionCaretType.RANGE,
    });
}

describe('cross-block copy with an atx-heading endpoint', () => {
    it('keeps the whole heading (with marker) when selected from its start', () => {
        const muya = bootMuya('# Heading\n\npara\n');
        const sp = muya.editor.scrollPage!;
        const heading = sp.firstContentInDescendant()!;
        const para = sp.lastContentInDescendant()!;
        // from offset 0 of "# Heading" through "pa"
        stub(muya, heading, 0, para, 2);

        const { text } = muya.editor.clipboard.getClipboardData();
        // marker rides in the text; re-parses to a heading on paste
        expect(text).toBe('# Heading\n\npa\n');
    });

    it('drops the marker when the selection starts after it', () => {
        const muya = bootMuya('# Heading\n\npara\n');
        const sp = muya.editor.scrollPage!;
        const heading = sp.firstContentInDescendant()!;
        const para = sp.lastContentInDescendant()!;
        // from offset 2 ("# |Heading") through "pa"
        stub(muya, heading, 2, para, 2);

        const { text } = muya.editor.clipboard.getClipboardData();
        expect(text).toBe('Heading\n\npa\n');
    });
});

describe('cross-block copy with a setext-heading endpoint', () => {
    it('keeps the whole setext heading when selected from its start', () => {
        const muya = bootMuya('Heading\n===\n\npara\n');
        const sp = muya.editor.scrollPage!;
        const heading = sp.firstContentInDescendant()!;
        const para = sp.lastContentInDescendant()!;
        stub(muya, heading, 0, para, 2);

        const { text } = muya.editor.clipboard.getClipboardData();
        expect(text).toBe('Heading\n===\n\npa\n');
    });

    it('keeps the heading (underline from meta) on a partial selection', () => {
        const muya = bootMuya('Heading\n===\n\npara\n');
        const sp = muya.editor.scrollPage!;
        const heading = sp.firstContentInDescendant()!;
        const para = sp.lastContentInDescendant()!;
        // from offset 2 ("He|ading") through "pa"
        stub(muya, heading, 2, para, 2);

        const { text } = muya.editor.clipboard.getClipboardData();
        expect(text).toBe('ading\n===\n\npa\n');
    });
});

describe('cross-block copy with a code-block endpoint', () => {
    it('truncates the code body to the caret and keeps the fence + language', () => {
        const muya = bootMuya('para\n\n```js\nconst a = 1\n```\n');
        const sp = muya.editor.scrollPage!;
        const para = sp.firstContentInDescendant()!;
        const codeBody = sp.lastContentInDescendant()!;
        // from "pa" of para to after "co" in the code body
        stub(muya, para, 2, codeBody, 2);

        const { text } = muya.editor.clipboard.getClipboardData();
        expect(text).toBe('ra\n\n```js\nco\n```\n');
    });

    it('keeps the whole code block when its body is fully selected', () => {
        const muya = bootMuya('para\n\n```js\nconst a = 1\n```\n');
        const sp = muya.editor.scrollPage!;
        const para = sp.firstContentInDescendant()!;
        const codeBody = sp.lastContentInDescendant()!;
        stub(muya, para, 2, codeBody, codeBody.text.length);

        const { text } = muya.editor.clipboard.getClipboardData();
        expect(text).toBe('ra\n\n```js\nconst a = 1\n```\n');
    });
});
