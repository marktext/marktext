// @vitest-environment happy-dom

import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// CHARACTERIZATION — codeBlockContent enter / backspace handlers.
//
// `CodeBlockContent` (src/block/content/codeBlockContent/index.ts) owns three
// keystroke paths that the migration audit flagged as untested:
//   - backspaceHandler at offset 0 converts the whole code block back into a
//     plain paragraph (data-loss guard — the code text must survive verbatim);
//   - the plain enterHandler inserts `\n` plus the line indent (and, when the
//     caret sits between an auto-indent pair, an extra tabSize block);
//   - Shift+Enter jumps OUT of the code block, appending a trailing paragraph
//     when there is no following content.
//
// We boot a real Muya so the json1 op / selection plumbing matches a live
// keystroke, then drive the handler off the resolved content block the way the
// keydown listener does (the handler reads `getCursor()` + `this.text`).

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
    document.getSelection()?.removeAllRanges();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

// Resolve the single `codeblock.content` leaf, the way a click on the code
// block resolves the active content block.
function codeContent(muya: Muya): Content {
    let target: Content | null = null;
    const visit = (block: {
        constructor: { blockName?: string };
        children?: { forEach: (cb: (b: unknown) => void) => void };
    }) => {
        if (block.constructor.blockName === 'codeblock.content')
            target = block as unknown as Content;
        block.children?.forEach(b => visit(b as typeof block));
    };
    visit(muya.editor.scrollPage as unknown as Parameters<typeof visit>[0]);
    if (!target)
        throw new Error('codeblock.content block not found');
    return target;
}

function keyEvent(over: Partial<KeyboardEvent> = {}): KeyboardEvent {
    return {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        key: 'Enter',
        shiftKey: false,
        ...over,
    } as unknown as KeyboardEvent;
}

function flush(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

describe('codeBlockContent.backspaceHandler — offset-0 converts to paragraph', () => {
    it('replaces the code block with a paragraph whose text equals the code text', async () => {
        const muya = bootMuya('```js\nconst a = 1\n```\n');
        const content = codeContent(muya);
        muya.editor.activeContentBlock = content;
        content.setCursor(0, 0, true);

        const original = content.text;
        const event = keyEvent({ key: 'Backspace' });
        content.backspaceHandler(event);

        await flush();
        const state = muya.getState();
        expect(state[0].name).toBe('paragraph');
        // Data-loss guard: the code text survives verbatim into the paragraph.
        expect((state[0] as { text: string }).text).toBe(original);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
    });

    it('lands the caret at offset 0 of the new paragraph', async () => {
        const muya = bootMuya('```js\nhello\n```\n');
        const content = codeContent(muya);
        muya.editor.activeContentBlock = content;
        content.setCursor(0, 0, true);

        content.backspaceHandler(keyEvent({ key: 'Backspace' }));

        await flush();
        const newContent = muya.editor.activeContentBlock!;
        const cursor = newContent.getCursor();
        expect(cursor).not.toBeNull();
        expect(cursor!.start.offset).toBe(0);
        expect(cursor!.end.offset).toBe(0);
    });

    it('does NOT convert to a paragraph when the cursor is past offset 0', async () => {
        const muya = bootMuya('```js\nfoo\n```\n');
        const content = codeContent(muya);
        muya.editor.activeContentBlock = content;
        // Caret one in from the start — the offset-0 conversion branch must not fire.
        content.setCursor(1, 1, true);

        const event = keyEvent({ key: 'Backspace' });
        content.backspaceHandler(event);

        await flush();
        const state = muya.getState();
        // The block stays a code-block: the offset-0 paragraph conversion guard
        // only triggers when start === end === 0.
        expect(state[0].name).toBe('code-block');
    });
});

describe('codeBlockContent.enterHandler — plain Enter inserts newline + indent', () => {
    it('keeps the 2-space indent and advances the caret by 1 + indent.length', () => {
        const muya = bootMuya('```js\nfoo\n```\n');
        const content = codeContent(muya);
        // Drive the indent logic on a known single-line text without depending
        // on the parser-produced text shape: the handler reads `this.text` and
        // the caret offset, then rewrites `this.text` in place.
        content.text = '  foo';
        muya.editor.activeContentBlock = content;
        content.setCursor(5, 5, true);

        const event = keyEvent({ key: 'Enter' });
        content.enterHandler(event);

        // indent = leading whitespace `  `; no auto-indent pair at the caret.
        expect(content.text).toBe('  foo\n  ');
        const cursor = content.getCursor()!;
        // offset = start(5) + 1 (newline) + indent.length(2)
        expect(cursor.start.offset).toBe(8);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
    });

    it('inherits the CURRENT line indent when Enter is pressed on a later line, not line 0', () => {
        const muya = bootMuya('```js\nfoo\n```\n');
        const content = codeContent(muya);
        // Two lines: line 0 has no indent, line 1 is indented 4 spaces.
        content.text = 'def foo():\n    bar()';
        muya.editor.activeContentBlock = content;
        const offset = content.text.length; // caret at end of the indented 2nd line
        content.setCursor(offset, offset, true);

        content.enterHandler(keyEvent({ key: 'Enter' }));

        // The new line must inherit line 1's 4-space indent, not line 0's empty indent.
        expect(content.text).toBe('def foo():\n    bar()\n    ');
        const cursor = content.getCursor()!;
        expect(cursor.start.offset).toBe(offset + 1 + 4);
    });

    it('adds an extra tabSize block when the caret sits inside an auto-indent pair', () => {
        const muya = bootMuya('```js\nfoo\n```\n');
        const content = codeContent(muya);
        // Caret between `{` and `}` → checkAutoIndent true; default tabSize 4.
        content.text = '{}';
        muya.editor.activeContentBlock = content;
        content.setCursor(1, 1, true);

        content.enterHandler(keyEvent({ key: 'Enter' }));

        // `{` + \n + (indent + 4 spaces) + \n + (indent) + `}`; indent is '' here.
        expect(content.text).toBe('{\n    \n}');
        const cursor = content.getCursor()!;
        // offset = start(1) + 1 + indent.length(0) + tabSize(4)
        expect(cursor.start.offset).toBe(6);
        expect(muya.options.tabSize).toBe(4);
    });
});

describe('codeBlockContent.enterHandler — Shift+Enter jumps out of the code block', () => {
    it('appends a trailing paragraph and moves the caret to it when nothing follows', async () => {
        // A doc that is ONLY a fenced code block — no following content block.
        const muya = bootMuya('```js\ncode\n```');
        const content = codeContent(muya);
        muya.editor.activeContentBlock = content;
        content.setCursor(content.text.length, content.text.length, true);

        const before = muya.getState().length;
        const event = keyEvent({ key: 'Enter', shiftKey: true });
        content.enterHandler(event);

        await flush();
        const state = muya.getState();
        expect(state.length).toBe(before + 1);
        expect(state[state.length - 1].name).toBe('paragraph');
        // Caret moved to the new trailing paragraph at offset 0.
        const active = muya.editor.activeContentBlock!;
        expect(active.blockName).toBe('paragraph.content');
        expect(active.getCursor()!.start.offset).toBe(0);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
    });

    it('moves the caret to the following block when one already exists (no new block)', async () => {
        const muya = bootMuya('```js\ncode\n```\n\nafter\n');
        const content = codeContent(muya);
        muya.editor.activeContentBlock = content;
        content.setCursor(content.text.length, content.text.length, true);

        const before = muya.getState().length;
        content.enterHandler(keyEvent({ key: 'Enter', shiftKey: true }));

        await flush();
        const state = muya.getState();
        // Reuses the existing next content block — no paragraph is appended.
        expect(state.length).toBe(before);
        const active = muya.editor.activeContentBlock!;
        expect(active.text).toBe('after');
    });
});
