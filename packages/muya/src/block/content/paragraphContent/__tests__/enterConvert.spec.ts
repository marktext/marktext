// @vitest-environment happy-dom

import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// ENTER-CONVERT GUARD — pressing Enter on a top-level paragraph whose text is a
// block-conversion trigger replaces the paragraph with the matching block.
//
// `ParagraphContent.enterHandler` routes a plain (non-shift) Enter on a
// top-level paragraph through `_enterConvert`. That method inspects `this.text`:
//   - `$$`            -> math-block
//   - ```` ```lang ```` -> fenced code-block with meta.lang
//   - `<tag>` (non-void html) -> html-block `<tag>\n\n</tag>`
//   - `| ... |` with even backlash counts -> table (see tableConversion.spec)
// Anything else (including VOID html tags like `<br>` and pipe rows with an odd
// escaped pipe) falls through to `Format.enterHandler`, which just splits the
// paragraph — the block STAYS a paragraph. These characterization tests drive
// the handler the way the keydown listener does and assert the document state
// after the json1 op flushes on the next frame.

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

// Find the leaf `.content` block whose rendered text matches `text`, the way a
// click resolves the active content block.
function contentByText(muya: Muya, text: string): Content {
    let target: Content | null = null;
    const visit = (block: {
        text?: string;
        constructor: { blockName?: string };
        children?: { forEach: (cb: (b: unknown) => void) => void };
    }) => {
        if (block.constructor.blockName?.endsWith('.content') && block.text === text)
            target = block as unknown as Content;
        block.children?.forEach(b => visit(b as typeof block));
    };
    visit(muya.editor.scrollPage as unknown as Parameters<typeof visit>[0]);
    if (!target)
        throw new Error(`content block with text "${text}" not found`);
    return target;
}

// Replace the paragraph content's text with a conversion trigger, render it,
// land the caret at the end, then route a plain Enter through the handler the
// way the keydown listener does.
function enterWithText(muya: Muya, content: Content, text: string): { preventDefault: ReturnType<typeof vi.fn> } {
    muya.editor.activeContentBlock = content;
    content.text = text;
    content.update();
    const offset = content.text.length;
    content.setCursor(offset, offset, true);
    const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        shiftKey: false,
        key: 'Enter',
    } as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> };
    content.enterHandler(event);
    return event;
}

function flush(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

describe('enter on `$$` — converts to a math-block', () => {
    it('replaces the paragraph with a single math-block', async () => {
        const muya = bootMuya('seed\n');
        const content = contentByText(muya, 'seed');

        enterWithText(muya, content, '$$');

        await flush();
        const state = muya.getState();
        expect(state.length).toBe(1);
        expect(state[0].name).toBe('math-block');
    });

    it('seeds the math-block with empty text', async () => {
        const muya = bootMuya('seed\n');
        const content = contentByText(muya, 'seed');

        enterWithText(muya, content, '$$');

        await flush();
        const state = muya.getState();
        expect((state[0] as { text: string }).text).toBe('');
    });

    it('calls preventDefault so the browser cannot insert a native newline', () => {
        const muya = bootMuya('seed\n');
        const content = contentByText(muya, 'seed');

        const event = enterWithText(muya, content, '$$');

        expect(event.preventDefault).toHaveBeenCalled();
    });
});

describe('enter on ```` ```js ```` — converts to a fenced code-block', () => {
    it('replaces the paragraph with a single code-block', async () => {
        const muya = bootMuya('seed\n');
        const content = contentByText(muya, 'seed');

        enterWithText(muya, content, '```js');

        await flush();
        const state = muya.getState();
        expect(state.length).toBe(1);
        expect(state[0].name).toBe('code-block');
    });

    it('records meta.lang === "js" and meta.type === "fenced"', async () => {
        const muya = bootMuya('seed\n');
        const content = contentByText(muya, 'seed');

        enterWithText(muya, content, '```js');

        await flush();
        const state = muya.getState();
        const meta = (state[0] as { meta: { lang: string; type: string } }).meta;
        expect(meta.lang).toBe('js');
        expect(meta.type).toBe('fenced');
    });

    it('seeds the code-block with empty text', async () => {
        const muya = bootMuya('seed\n');
        const content = contentByText(muya, 'seed');

        enterWithText(muya, content, '```js');

        await flush();
        const state = muya.getState();
        expect((state[0] as { text: string }).text).toBe('');
    });
});

// #2177: typing ```` ```mermaid ```` (or any diagram language) and pressing
// Enter must produce a diagram block, the same as loading that fence from a
// file. The file-load path (markdownToState) already routes the five diagram
// languages to a `diagram` state; the live-typing path must match.
describe('enter on ```` ```mermaid ```` — converts to a diagram block', () => {
    it('replaces the paragraph with a single diagram block (not a code-block)', async () => {
        const muya = bootMuya('seed\n');
        const content = contentByText(muya, 'seed');

        enterWithText(muya, content, '```mermaid');

        await flush();
        const state = muya.getState();
        expect(state.length).toBe(1);
        expect(state[0].name).toBe('diagram');
    });

    it('records meta.type === "mermaid" and meta.lang === "yaml"', async () => {
        const muya = bootMuya('seed\n');
        const content = contentByText(muya, 'seed');

        enterWithText(muya, content, '```mermaid');

        await flush();
        const state = muya.getState();
        const meta = (state[0] as { meta: { lang: string; type: string } }).meta;
        expect(meta.type).toBe('mermaid');
        expect(meta.lang).toBe('yaml');
    });

    it('uses meta.lang === "json" for a vega-lite fence', async () => {
        const muya = bootMuya('seed\n');
        const content = contentByText(muya, 'seed');

        enterWithText(muya, content, '```vega-lite');

        await flush();
        const state = muya.getState();
        expect(state[0].name).toBe('diagram');
        const meta = (state[0] as { meta: { lang: string; type: string } }).meta;
        expect(meta.type).toBe('vega-lite');
        expect(meta.lang).toBe('json');
    });

    it('still converts a non-diagram fence (```js) to a code-block', async () => {
        const muya = bootMuya('seed\n');
        const content = contentByText(muya, 'seed');

        enterWithText(muya, content, '```js');

        await flush();
        const state = muya.getState();
        expect(state[0].name).toBe('code-block');
    });
});

describe('enter on `<div>` — converts to an html-block', () => {
    it('replaces the paragraph with a single html-block', async () => {
        const muya = bootMuya('seed\n');
        const content = contentByText(muya, 'seed');

        enterWithText(muya, content, '<div>');

        await flush();
        const state = muya.getState();
        expect(state.length).toBe(1);
        expect(state[0].name).toBe('html-block');
    });

    it('seeds the html-block text with the open/close tag pair', async () => {
        const muya = bootMuya('seed\n');
        const content = contentByText(muya, 'seed');

        enterWithText(muya, content, '<div>');

        await flush();
        const state = muya.getState();
        expect((state[0] as { text: string }).text).toBe('<div>\n\n</div>');
    });

    it('lands the caret at offset tagName.length + 3 inside the html-block', async () => {
        const muya = bootMuya('seed\n');
        const content = contentByText(muya, 'seed');

        enterWithText(muya, content, '<div>');

        await flush();
        const htmlContent = contentByText(muya, '<div>\n\n</div>');
        const cursor = htmlContent.getCursor();
        expect(cursor).not.toBeNull();
        // tagName 'div' length 3 + 3 === 6.
        expect(cursor!.start.offset).toBe(6);
    });
});

describe('enter on `<br>` (VOID html tag) — NOT converted', () => {
    it('keeps the block a paragraph (no html-block) — it just splits', async () => {
        const muya = bootMuya('seed\n');
        const content = contentByText(muya, 'seed');

        enterWithText(muya, content, '<br>');

        await flush();
        const state = muya.getState();
        // Fell through to Format.enterHandler: the paragraph split into two
        // paragraphs (no html-block conversion).
        expect(state.length).toBe(2);
        expect(state.every(block => block.name === 'paragraph')).toBe(true);
        expect(state.some(block => block.name === 'html-block')).toBe(false);
    });

    it('keeps the `<br>` text on the first paragraph (cursor was at end)', async () => {
        const muya = bootMuya('seed\n');
        const content = contentByText(muya, 'seed');

        enterWithText(muya, content, '<br>');

        await flush();
        const state = muya.getState();
        expect((state[0] as { text: string }).text).toBe('<br>');
    });
});

describe('enter on `|a\\|b|c|` (odd escaped pipe) — NOT converted', () => {
    it('keeps the block a paragraph (no table) — it just splits', async () => {
        const muya = bootMuya('seed\n');
        const content = contentByText(muya, 'seed');

        enterWithText(muya, content, '|a\\|b|c|');

        await flush();
        const state = muya.getState();
        // Odd escaped pipe fails the isLengthEven guard: fell through to
        // Format.enterHandler, splitting the paragraph (no table conversion).
        expect(state.length).toBe(2);
        expect(state.every(block => block.name === 'paragraph')).toBe(true);
        expect(state.some(block => block.name === 'table')).toBe(false);
    });

    it('keeps the pipe-row text on the first paragraph (cursor was at end)', async () => {
        const muya = bootMuya('seed\n');
        const content = contentByText(muya, 'seed');

        enterWithText(muya, content, '|a\\|b|c|');

        await flush();
        const state = muya.getState();
        expect((state[0] as { text: string }).text).toBe('|a\\|b|c|');
    });
});
