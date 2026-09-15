// @vitest-environment happy-dom

import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// A footnote definition is a container of its own: Backspace at the start of
// its first paragraph removes the wrapper and leaves the paragraphs in place,
// the way Backspace at the start of a block-quote does.

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
    const muya = new Muya(host, { markdown, footnote: true } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

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

function pressAtStart(muya: Muya, content: Content, key: 'Backspace' | 'Enter'): void {
    muya.editor.activeContentBlock = content;
    content.setCursor(0, 0, true);
    const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        shiftKey: false,
        key,
    } as unknown as KeyboardEvent;
    if (key === 'Backspace')
        content.backspaceHandler(event);
    else
        content.enterHandler(event);
}

interface IShapeNode {
    name: string;
    text?: string;
    children?: IShapeNode[];
}

// Compact picture of the document: `p"text"` for paragraphs, `name(...)` for
// containers.
function shapeOf(nodes: IShapeNode[]): string {
    return nodes.map((node) => {
        const label = node.name === 'paragraph' ? `p"${node.text}"` : node.name;

        return node.children ? `${label}(${shapeOf(node.children)})` : label;
    }).join(', ');
}

// Apply the queued edits now; a malformed op throws here instead of in a frame
// callback the test cannot observe.
function flushState(muya: Muya): string {
    muya.editor.jsonState.flush();

    return shapeOf(muya.getState() as IShapeNode[]);
}

function caretOf(muya: Muya): string {
    const active = muya.editor.activeContentBlock!;

    return `${active.text}@${active.getCursor()?.start.offset}`;
}

describe('backspace at the start of a top-level footnote (#5343)', () => {
    it('removes the wrapper after a paragraph instead of merging and leaving an empty definition', () => {
        const muya = bootMuya('x\n\n[^1]: note\n');

        pressAtStart(muya, contentByText(muya, 'note'), 'Backspace');

        expect(flushState(muya)).toBe('p"x", p"note"');
        expect(muya.getMarkdown()).toBe('x\n\nnote\n');
        expect(caretOf(muya)).toBe('note@0');
    });

    it('removes the wrapper when the footnote is the first block of the document', () => {
        const muya = bootMuya('[^1]: note\n');

        pressAtStart(muya, contentByText(muya, 'note'), 'Backspace');

        expect(flushState(muya)).toBe('p"note"');
        expect(caretOf(muya)).toBe('note@0');
    });

    it('keeps every paragraph of a multi-paragraph footnote, in order', () => {
        const muya = bootMuya('x\n\n[^1]: note\n\n    more\n');

        pressAtStart(muya, contentByText(muya, 'note'), 'Backspace');

        expect(flushState(muya)).toBe('p"x", p"note", p"more"');
        expect(caretOf(muya)).toBe('note@0');
    });

    it('still merges a later paragraph into the previous one inside the footnote', () => {
        const muya = bootMuya('x\n\n[^1]: note\n\n    more\n');

        pressAtStart(muya, contentByText(muya, 'more'), 'Backspace');

        expect(flushState(muya)).toBe('p"x", footnote(p"notemore")');
        expect(caretOf(muya)).toBe('notemore@4');
    });

    it('keeps Enter at the start of the footnote inside the footnote', () => {
        const muya = bootMuya('x\n\n[^1]: note\n');

        pressAtStart(muya, contentByText(muya, 'note'), 'Enter');

        expect(flushState(muya)).toBe('p"x", footnote(p"", p"note")');
    });
});

// Backspace and Enter used the handlers of the nearest list item or quote
// ancestor, which assume that container holds the paragraph directly. With a
// footnote in between, Backspace appended a block into the list item's first
// paragraph and the flush threw "Cannot use numerical key for object
// container"; Enter nested a list item inside the list item.
describe('a footnote inside a list item or quote is edited as a footnote (#5340)', () => {
    it('removes the wrapper inside a list item without breaking the state', () => {
        const muya = bootMuya('- a\n\n  [^1]: note\n');

        pressAtStart(muya, contentByText(muya, 'note'), 'Backspace');

        expect(flushState(muya)).toBe('bullet-list(list-item(p"a", p"note"))');
        expect(muya.getMarkdown()).toBe('- a\n\n  note\n');
        expect(caretOf(muya)).toBe('note@0');
    });

    it('removes the wrapper inside a task list item', () => {
        const muya = bootMuya('- [ ] a\n\n  [^1]: note\n');

        pressAtStart(muya, contentByText(muya, 'note'), 'Backspace');

        expect(flushState(muya)).toBe('task-list(task-list-item(p"a", p"note"))');
    });

    it('keeps every paragraph of a footnote inside a quote', () => {
        const muya = bootMuya('> a\n>\n> [^1]: note\n>\n>     more\n');

        pressAtStart(muya, contentByText(muya, 'note'), 'Backspace');

        expect(flushState(muya)).toBe('block-quote(p"a", p"note", p"more")');
    });

    it('keeps Enter inside a footnote that sits in a list item', () => {
        const muya = bootMuya('- a\n\n  [^1]: note\n');

        pressAtStart(muya, contentByText(muya, 'note'), 'Enter');

        expect(flushState(muya)).toBe('bullet-list(list-item(p"a", footnote(p"", p"note")))');
    });
});

describe('paragraphs directly in a list item or quote keep their handling', () => {
    it.each([
        ['- a\n\n  > q\n', 'q', 'Backspace', 'bullet-list(list-item(p"a", p"q"))'],
        ['> - a\n>\n>   c\n', 'c', 'Backspace', 'block-quote(bullet-list(list-item(p"ac")))'],
        ['> - a\n', 'a', 'Backspace', 'block-quote(p"a")'],
        ['- a\n  - b\n', 'b', 'Backspace', 'bullet-list(list-item(p"a", p"b"))'],
        ['- a\n  - b\n', 'b', 'Enter', 'bullet-list(list-item(p"a", bullet-list(list-item(p""), list-item(p"b"))))'],
        ['- a\n\n  > q\n', 'q', 'Enter', 'bullet-list(list-item(p"a", block-quote(p"", p"q")))'],
        ['> - a\n>\n>   c\n', 'c', 'Enter', 'block-quote(bullet-list(list-item(p"a", p"", p"c")))'],
    ] as const)('%j + %s at the start of %s', (markdown, text, key, shape) => {
        const muya = bootMuya(markdown);

        pressAtStart(muya, contentByText(muya, text), key);

        expect(flushState(muya)).toBe(shape);
    });
});
