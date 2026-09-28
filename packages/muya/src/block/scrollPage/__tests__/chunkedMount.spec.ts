// @vitest-environment happy-dom

import * as json1 from 'ot-json1';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';

// Chunked initial mount (#4887): documents beyond the synchronous prefix
// finish mounting in scheduled chunks; whole-tree consumers force the rest.

const SECTIONS = 600;

function buildDoc(): string {
    return `${Array.from({ length: SECTIONS }, (_, i) => `Paragraph ${i}`).join('\n\n')}\n`;
}

function mountedParagraphs(muya: Muya): number {
    return muya.domNode.querySelectorAll('p.mu-paragraph').length;
}

// Exact sequence equality between the rendered paragraphs and the state —
// catches duplication, loss, and reordering that substring checks miss.
function expectDomMatchesState(muya: Muya) {
    const dom = Array.from(muya.domNode.querySelectorAll('p.mu-paragraph')).map(
        node => node.textContent?.trim(),
    );
    const state = muya
        .getState()
        .filter(entry => entry.name === 'paragraph')
        .map(entry => (entry as { text: string }).text);
    expect(dom).toEqual(state);
}

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    document.getSelection()?.removeAllRanges();
});

function bootMuya(): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown: buildDoc() } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

describe('scrollPage chunked mount', () => {
    it('mounts a prefix synchronously and the rest in scheduled chunks', () => {
        const muya = bootMuya();

        expect(mountedParagraphs(muya)).toBe(512);

        vi.runAllTimers();

        expect(mountedParagraphs(muya)).toBe(SECTIONS);
        muya.destroy();
    });

    it('flushes the pending tail for end-of-document consumers', () => {
        const muya = bootMuya();
        expect(mountedParagraphs(muya)).toBe(512);

        const last = muya.editor.scrollPage!.lastContentInDescendant();

        expect(mountedParagraphs(muya)).toBe(SECTIONS);
        expect(last?.text).toBe(`Paragraph ${SECTIONS - 1}`);
        muya.destroy();
    });

    it('serializes the full document while a mount is pending', () => {
        const muya = bootMuya();
        expect(mountedParagraphs(muya)).toBe(512);

        // Markdown comes from jsonState, not the DOM — never truncated.
        expect(muya.getMarkdown()).toContain(`Paragraph ${SECTIONS - 1}`);
        muya.destroy();
    });

    it('updateState cancels a pending mount instead of appending stale blocks', () => {
        const muya = bootMuya();
        expect(mountedParagraphs(muya)).toBe(512);

        muya.setContent('only one\n');
        vi.runAllTimers();

        expect(mountedParagraphs(muya)).toBe(1);
        expect(muya.domNode.textContent).not.toContain('Paragraph 599');
        muya.destroy();
    });

    it('reports the complete TOC while a mount is pending (review repro 1)', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const markdown = `${Array.from({ length: 599 }, (_, i) => `Paragraph ${i}`).join('\n\n')}\n\n# Tail Heading\n`;
        const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
        muya.init();
        bootedHosts.push(muya.domNode);

        expect(mountedParagraphs(muya)).toBeLessThan(599);
        const toc = muya.getTOC();
        expect(toc).toHaveLength(1);
        expect(toc[0].content).toBe('Tail Heading');
        muya.destroy();
    });

    it('mounts a detached host to completion (review repro 4)', () => {
        const host = document.createElement('div');
        // Never appended to the document.
        const muya = new Muya(host, { markdown: buildDoc() } as ConstructorParameters<typeof Muya>[1]);
        muya.init();

        expect(mountedParagraphs(muya)).toBe(512);
        vi.runAllTimers();
        expect(mountedParagraphs(muya)).toBe(SECTIONS);
        muya.destroy();
    });

    it('ensureMountedThrough mounts only up to the requested index', () => {
        const muya = bootMuya();
        expect(mountedParagraphs(muya)).toBe(512);

        muya.editor.scrollPage!.ensureMountedThrough(549);

        const mounted = mountedParagraphs(muya);
        expect(mounted).toBeGreaterThanOrEqual(550);
        expect(mounted).toBeLessThan(SECTIONS);
        vi.runAllTimers();
        expect(mountedParagraphs(muya)).toBe(SECTIONS);
        muya.destroy();
    });

    it('an insertion during the mount window keeps mounting the correct tail', () => {
        const muya = bootMuya();
        expect(mountedParagraphs(muya)).toBe(512);

        // Simulate an edit inserting a top-level block (Enter/paste path):
        // live tree and state change at the same index, so the pending tail
        // keeps mounting without any flush and without duplication.
        const scrollPage = muya.editor.scrollPage!;
        const newBlock = (scrollPage.constructor as typeof import('../index').ScrollPage)
            .loadBlock('paragraph')
            .create(muya, { name: 'paragraph', text: 'inserted' } as never);
        scrollPage.append(newBlock as never, 'user');

        vi.runAllTimers();
        expect(mountedParagraphs(muya)).toBe(SECTIONS + 1);
        expect(muya.domNode.textContent).toContain(`Paragraph ${SECTIONS - 1}`);
        muya.destroy();
    });

    it('removing a mounted block during the window stays consistent (review repro 3)', () => {
        const muya = bootMuya();
        expect(mountedParagraphs(muya)).toBe(512);

        // Deletion goes through the block's own remove(), which bypasses any
        // ScrollPage override — the live-cursor design must not care.
        const first = muya.editor.scrollPage!.firstChild as { remove: (source?: string) => void };
        first.remove('user');
        expect(mountedParagraphs(muya)).toBe(511);

        muya.editor.scrollPage!.ensureMountedThrough(511);
        expect(mountedParagraphs(muya)).toBe(512);

        vi.runAllTimers();
        expect(mountedParagraphs(muya)).toBe(SECTIONS - 1);
        expectDomMatchesState(muya);
        muya.destroy();
    });

    it('an op targeting the unmounted tail is applied exactly once (review blocker 1)', () => {
        const muya = bootMuya();
        expect(mountedParagraphs(muya)).toBe(512);

        // Insert at index 550 — beyond the mounted prefix. updateContents
        // must mount the target from the PRE-dispatch state, otherwise the
        // DOM drop re-applies the op to a block built from the updated state.
        muya.editor.updateContents(
            json1.insertOp([550], { name: 'paragraph', text: 'remote inserted' } as never)!,
            null,
            'api',
        );

        vi.runAllTimers();
        expect(mountedParagraphs(muya)).toBe(SECTIONS + 1);
        expectDomMatchesState(muya);
        muya.destroy();
    });

    it('a text edit into the unmounted tail is applied exactly once (review blocker 1)', () => {
        const muya = bootMuya();
        expect(mountedParagraphs(muya)).toBe(512);

        muya.editor.updateContents(
            json1.editOp([560, 'text'], 'text-unicode', ['Paragraph 560'.length, 'x'])!,
            null,
            'api',
        );

        vi.runAllTimers();
        expectDomMatchesState(muya);
        expect(muya.domNode.textContent).toContain('Paragraph 560x');
        expect(muya.domNode.textContent).not.toContain('Paragraph 560xx');
        muya.destroy();
    });

    it('tail blocks never share meta objects with the state (review: shared meta)', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const parts = Array.from({ length: 560 }, (_, i) => `Paragraph ${i}`);
        parts[550] = '```js\ncode\n```';
        const muya = new Muya(host, {
            markdown: `${parts.join('\n\n')}\n`,
        } as ConstructorParameters<typeof Muya>[1]);
        muya.init();
        bootedHosts.push(muya.domNode);

        muya.editor.scrollPage!.ensureMountedThrough(550);
        const block = muya.editor.scrollPage!.find(550) as unknown as { meta?: object };
        const stateNode = muya.editor.jsonState.rawState[550] as { meta?: object };

        expect(block.meta).toBeDefined();
        expect(stateNode.meta).toBeDefined();
        // A shared object would let block-level edits rewrite the JSON state
        // ahead of their op — the op then applies on top of itself.
        expect(block.meta).not.toBe(stateNode.meta);
        muya.destroy();
    });

    it('a replace at the mount boundary applies exactly once (review: boundary replace)', () => {
        const muya = bootMuya();
        expect(mountedParagraphs(muya)).toBe(512);

        muya.editor.updateContents(
            json1.replaceOp(
                [550],
                { name: 'paragraph', text: 'Paragraph 550' } as never,
                { name: 'paragraph', text: 'replacement' } as never,
            )!,
            null,
            'api',
        );

        vi.runAllTimers();
        expectDomMatchesState(muya);
        const texts = Array.from(muya.domNode.querySelectorAll('p.mu-paragraph')).map(
            node => node.textContent?.trim(),
        );
        expect(texts.filter(text => text === 'replacement')).toHaveLength(1);
        expect(texts).toContain('Paragraph 551');
        muya.destroy();
    });

    it('undo flushes a same-frame edit into the history first (review: swallowed edit)', () => {
        const muya = bootMuya();

        // A recorded edit deep in the tail — undoing it triggers the
        // on-demand mount path.
        muya.editor.updateContents(
            json1.editOp([550, 'text'], 'text-unicode', ['Paragraph 550'.length, '!'])!,
            null,
            'user',
        );
        // Step past the history coalescing window so the next edit is its
        // own entry.
        vi.advanceTimersByTime(5000);

        // A same-frame edit that has NOT flushed through the rAF batch yet.
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        muya.editor.activeContentBlock = first as never;
        first.setCursor(0, 0, true);
        (first as unknown as { text: string }).text = 'Paragraph 0 edited';

        muya.undo();

        // The pending edit must have entered the stack and been popped —
        // not applied while its history entry was silently dropped.
        expect((first as unknown as { text: string }).text).toBe('Paragraph 0');
        expect(muya.getHistory().stack.undo.length).toBeGreaterThan(0);
        muya.destroy();
    });

    it('redo with a pending same-frame edit invalidates quietly (review: redo crash)', () => {
        const muya = bootMuya();

        // A recorded edit, undone — leaves exactly one redo entry.
        muya.editor.updateContents(
            json1.editOp([550, 'text'], 'text-unicode', ['Paragraph 550'.length, '!'])!,
            null,
            'user',
        );
        vi.advanceTimersByTime(5000);
        muya.undo();
        expect(muya.getHistory().stack.redo.length).toBe(1);

        // A new edit still sitting in the rAF batch. Flushing it inside
        // redo() records it — which clears the redo stack; redo must then
        // no-op instead of popping the emptied stack.
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        muya.editor.activeContentBlock = first as never;
        first.setCursor(0, 0, true);
        (first as unknown as { text: string }).text = 'Paragraph 0 edited';

        expect(() => muya.redo()).not.toThrow();
        expect((first as unknown as { text: string }).text).toBe('Paragraph 0 edited');
        expect(muya.getHistory().stack.redo.length).toBe(0);
        muya.destroy();
    });

    it('a pending first edit is undoable immediately (review: flush before stack check)', () => {
        const muya = bootMuya();
        expect(muya.getHistory().stack.undo.length).toBe(0);

        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        muya.editor.activeContentBlock = first as never;
        first.setCursor(0, 0, true);
        (first as unknown as { text: string }).text = 'Paragraph 0 edited';

        // The edit has not flushed through the rAF batch, so the undo stack
        // is still empty — undo() must flush first, then pop that entry.
        muya.undo();

        expect((first as unknown as { text: string }).text).toBe('Paragraph 0');
        muya.destroy();
    });

    it('setContent drops the old selection so focus() cannot deep-mount (review blocker 2)', () => {
        const muya = bootMuya();
        expect(mountedParagraphs(muya)).toBe(512);

        // Park the caret deep in the document (mounts through it).
        muya.setCursorByOffset({
            anchor: { line: 1100, ch: 3 },
            focus: { line: 1100, ch: 3 },
        });
        expect(mountedParagraphs(muya)).toBeGreaterThanOrEqual(551);

        // Replace the document; the stale anchorPath must not survive into
        // the new tree, or focus() would force-mount up to the old caret.
        muya.setContent(buildDoc());
        muya.editor.focus();
        expect(mountedParagraphs(muya)).toBe(512);

        vi.runAllTimers();
        expect(mountedParagraphs(muya)).toBe(SECTIONS);
        muya.destroy();
    });

    it('clicking below the frontier is inert while pending, appends after completion (review: blank-click)', () => {
        const muya = bootMuya();
        expect(mountedParagraphs(muya)).toBe(512);

        // muya's isMouseEvent guard checks the `x` alias, which happy-dom's
        // MouseEvent does not implement.
        const makeClick = () => {
            const click = new MouseEvent('click', {
                clientY: 10_000,
                bubbles: true,
                cancelable: true,
            });
            if (!('x' in click))
                Object.defineProperty(click, 'x', { value: 0 });
            return click;
        };

        // While the tail is pending, the area below the frontier is NOT
        // blank — the document continues there. No insert (the paragraph
        // would land at index 512, mid-document) and no forced mount (a
        // container tap must not freeze a large file).
        muya.editor.scrollPage!.domNode!.dispatchEvent(makeClick());
        muya.editor.jsonState.flush();
        expect(muya.editor.jsonState.rawState).toHaveLength(SECTIONS);
        expect(mountedParagraphs(muya)).toBe(512);

        // Once the background mount completes, the same click is a real
        // end-of-document gesture again.
        vi.runAllTimers();
        muya.editor.scrollPage!.domNode!.dispatchEvent(makeClick());
        muya.editor.jsonState.flush();
        const states = muya.editor.jsonState.rawState;
        expect(states).toHaveLength(SECTIONS + 1);
        expect((states[SECTIONS] as { text: string }).text).toBe('');
        muya.destroy();
    });

    it('arrow-down across an empty container at the frontier keeps mounting to a content (review: empty container)', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const muya = new Muya(host, { markdown: 'seed\n' } as ConstructorParameters<typeof Muya>[1]);
        muya.init();
        bootedHosts.push(muya.domNode);

        // 512 paragraphs, an EMPTY container (no content descendant), then a
        // trailing paragraph — one mount step past the frontier lands on the
        // empty container, which is NOT the document end.
        const states = [
            ...Array.from({ length: 512 }, (_, i) => ({
                name: 'paragraph',
                text: `Paragraph ${i}`,
            })),
            { name: 'block-quote', children: [] },
            { name: 'paragraph', text: 'Paragraph after empty container' },
        ];
        muya.setContent(states as never);
        expect(mountedParagraphs(muya)).toBe(512);

        const frontier = (muya.editor.scrollPage!.find(511) as unknown as {
            lastContentInDescendant: () => {
                text: string;
                setCursor: (start: number, end: number, focus?: boolean) => void;
                arrowHandler: (event: Event) => void;
            };
        }).lastContentInDescendant();
        expect(frontier.text).toBe('Paragraph 511');

        muya.editor.activeContentBlock = frontier as never;
        frontier.setCursor(0, 0, true);
        frontier.arrowHandler(
            new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }),
        );
        muya.editor.jsonState.flush();

        // No paragraph inserted between the prefix and the logical tail.
        expect(muya.editor.jsonState.rawState).toHaveLength(514);
        expect(muya.domNode.textContent).toContain('Paragraph after empty container');
        vi.runAllTimers();
        expectDomMatchesState(muya);
        muya.destroy();
    });

    it('the footnote tool sees definitions in the unmounted tail (review: footnote create)', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const parts = Array.from({ length: 599 }, (_, i) => `Paragraph ${i}`);
        parts[0] = 'Intro with a footnote[^tail] reference.';
        const markdown = `${parts.join('\n\n')}\n\n[^tail]: The definition lives in the tail.\n`;
        const muya = new Muya(host, {
            markdown,
            footnote: true,
        } as ConstructorParameters<typeof Muya>[1]);
        muya.init();
        bootedHosts.push(muya.domNode);
        expect(mountedParagraphs(muya)).toBeLessThan(599);

        const payloads: { footnotes: Map<string, unknown> }[] = [];
        muya.on('muya-footnote-tool', ((payload: { footnotes: Map<string, unknown> }) =>
            void payloads.push(payload)) as never);

        // The identifier→definition map must cover the WHOLE document: a
        // definition in the unmounted tail resolving as "missing" would make
        // the tool offer Create and duplicate it.
        const reference = document.createElement('sup');
        reference.id = 'noteref-tail';
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        (first as unknown as {
            _emitFootnoteToolEvent: (el: HTMLElement) => void;
        })._emitFootnoteToolEvent(reference);

        expect(payloads).toHaveLength(1);
        expect(payloads[0].footnotes.has('tail')).toBe(true);
        muya.destroy();
    });

    it('heading copy-link resolves against the flushed state (review: index skew)', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const muya = new Muya(host, {
            markdown: 'Paragraph 0\n\n# Section\n\nParagraph 2\n',
        } as ConstructorParameters<typeof Muya>[1]);
        muya.init();
        bootedHosts.push(muya.domNode);

        const slug = muya.getTOC()[0].slug;
        const handler = vi.fn();
        muya.on('heading-copy-link', handler);

        // A structural edit whose op still sits in the rAF batch: the live
        // tree moves the heading to index 0 while rawState keeps it at 1 —
        // resolving the block path against the unflushed state would slug
        // the wrong node.
        (muya.editor.scrollPage!.firstChild as unknown as {
            remove: (source?: string) => void;
        }).remove('user');

        muya.domNode
            .querySelector<HTMLElement>('[class*="copy-header-link"]')!
            .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0]).toEqual({ key: slug });
        muya.destroy();
    });

    it('arrowDown on the mount frontier navigates into the pending tail (review: frontier arrow)', () => {
        const muya = bootMuya();
        expect(mountedParagraphs(muya)).toBe(512);

        // Block 511 is the last MOUNTED block, not the last block: ArrowDown
        // must reach Paragraph 512, not append an empty paragraph between
        // the prefix and the pending tail.
        const frontier = (muya.editor.scrollPage!.find(511) as unknown as {
            lastContentInDescendant: () => {
                text: string;
                setCursor: (start: number, end: number, focus?: boolean) => void;
                arrowHandler: (event: Event) => void;
            };
        }).lastContentInDescendant();
        expect(frontier.text).toBe('Paragraph 511');

        muya.editor.activeContentBlock = frontier as never;
        frontier.setCursor(frontier.text.length, frontier.text.length, true);
        frontier.arrowHandler(
            new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }),
        );
        muya.editor.jsonState.flush();

        // No paragraph was inserted at the frontier...
        expect(muya.editor.jsonState.rawState).toHaveLength(SECTIONS);
        // ...and the successor is now mounted with the caret available in it.
        expect(mountedParagraphs(muya)).toBeGreaterThanOrEqual(513);
        expect(muya.domNode.textContent).toContain('Paragraph 512');
        vi.runAllTimers();
        expectDomMatchesState(muya);
        muya.destroy();
    });

    it('a click between blocks or in the gutter never flushes the pending tail (review: eager flush)', () => {
        const muya = bootMuya();
        expect(mountedParagraphs(muya)).toBe(512);

        // clientY does not clear the mounted tail's bottom: not an
        // end-of-document gesture — nothing mounts, nothing is inserted.
        const click = new MouseEvent('click', { clientY: 0, bubbles: true, cancelable: true });
        if (!('x' in click))
            Object.defineProperty(click, 'x', { value: 0 });
        muya.editor.scrollPage!.domNode!.dispatchEvent(click);
        muya.editor.jsonState.flush();

        expect(mountedParagraphs(muya)).toBe(512);
        expect(muya.editor.jsonState.rawState).toHaveLength(SECTIONS);
        muya.destroy();
    });

    it('enter in the last table row at the frontier navigates into the pending tail (review: table exit)', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const parts = Array.from({ length: SECTIONS }, (_, i) => `Paragraph ${i}`);
        parts[550] = '| a | b |\n| - | - |\n| c | d |';
        const muya = new Muya(host, {
            markdown: `${parts.join('\n\n')}\n`,
        } as ConstructorParameters<typeof Muya>[1]);
        muya.init();
        bootedHosts.push(muya.domNode);

        // Put the mount frontier exactly at the table.
        muya.editor.scrollPage!.ensureMountedThrough(550);
        const before = mountedParagraphs(muya);
        const cell = (muya.editor.scrollPage!.find(550) as unknown as {
            lastContentInDescendant: () => {
                text: string;
                setCursor: (start: number, end: number, focus?: boolean) => void;
                enterHandler: (event: Event) => void;
            };
        }).lastContentInDescendant();
        expect(cell.text).toBe('d');

        muya.editor.activeContentBlock = cell as never;
        cell.setCursor(1, 1, true);
        cell.enterHandler(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
        muya.editor.jsonState.flush();

        // No paragraph inserted at the frontier; the successor was mounted.
        expect(muya.editor.jsonState.rawState).toHaveLength(SECTIONS);
        expect(mountedParagraphs(muya)).toBeGreaterThan(before);
        vi.runAllTimers();
        expectDomMatchesState(muya);
        muya.destroy();
    });

    it('arrow-down in the last table row at the frontier navigates into the pending tail (review: table exit)', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const parts = Array.from({ length: SECTIONS }, (_, i) => `Paragraph ${i}`);
        parts[550] = '| a | b |\n| - | - |\n| c | d |';
        const muya = new Muya(host, {
            markdown: `${parts.join('\n\n')}\n`,
        } as ConstructorParameters<typeof Muya>[1]);
        muya.init();
        bootedHosts.push(muya.domNode);

        muya.editor.scrollPage!.ensureMountedThrough(550);
        const before = mountedParagraphs(muya);
        const cell = (muya.editor.scrollPage!.find(550) as unknown as {
            lastContentInDescendant: () => {
                text: string;
                setCursor: (start: number, end: number, focus?: boolean) => void;
                arrowHandler: (event: Event) => void;
            };
        }).lastContentInDescendant();

        muya.editor.activeContentBlock = cell as never;
        cell.setCursor(1, 1, true);
        cell.arrowHandler(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
        muya.editor.jsonState.flush();

        expect(muya.editor.jsonState.rawState).toHaveLength(SECTIONS);
        expect(mountedParagraphs(muya)).toBeGreaterThan(before);
        vi.runAllTimers();
        expectDomMatchesState(muya);
        muya.destroy();
    });

    it('shift-enter out of a code block at the frontier navigates into the pending tail (review: code exit)', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const parts = Array.from({ length: SECTIONS }, (_, i) => `Paragraph ${i}`);
        parts[550] = '```js\ncode\n```';
        const muya = new Muya(host, {
            markdown: `${parts.join('\n\n')}\n`,
        } as ConstructorParameters<typeof Muya>[1]);
        muya.init();
        bootedHosts.push(muya.domNode);

        muya.editor.scrollPage!.ensureMountedThrough(550);
        const before = mountedParagraphs(muya);
        const content = (muya.editor.scrollPage!.find(550) as unknown as {
            lastContentInDescendant: () => {
                text: string;
                setCursor: (start: number, end: number, focus?: boolean) => void;
                enterHandler: (event: KeyboardEvent) => void;
            };
        }).lastContentInDescendant();
        expect(content.text).toBe('code');

        muya.editor.activeContentBlock = content as never;
        content.setCursor(4, 4, true);
        content.enterHandler(
            new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, cancelable: true }),
        );
        muya.editor.jsonState.flush();

        expect(muya.editor.jsonState.rawState).toHaveLength(SECTIONS);
        expect(mountedParagraphs(muya)).toBeGreaterThan(before);
        vi.runAllTimers();
        expectDomMatchesState(muya);
        muya.destroy();
    });

    it('a footnote tap without a tool listener never flushes the pending tail (review: consumer gate)', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const parts = Array.from({ length: 599 }, (_, i) => `Paragraph ${i}`);
        parts[0] = 'Intro with a footnote[^tail] reference.';
        const markdown = `${parts.join('\n\n')}\n\n[^tail]: The definition lives in the tail.\n`;
        const muya = new Muya(host, {
            markdown,
            footnote: true,
        } as ConstructorParameters<typeof Muya>[1]);
        muya.init();
        bootedHosts.push(muya.domNode);
        const before = mountedParagraphs(muya);
        expect(before).toBeLessThan(599);

        // No `muya-footnote-tool` subscriber: preparing the whole-document
        // definition map would freeze a large file for nothing.
        const reference = document.createElement('sup');
        reference.id = 'noteref-tail';
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        (first as unknown as {
            _emitFootnoteToolEvent: (el: HTMLElement) => void;
        })._emitFootnoteToolEvent(reference);

        expect(mountedParagraphs(muya)).toBe(before);
        muya.destroy();
    });

    it('arrow-down across an ALREADY-MOUNTED empty container still reaches the tail (review: frontier start)', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const muya = new Muya(host, { markdown: 'seed\n' } as ConstructorParameters<typeof Muya>[1]);
        muya.init();
        bootedHosts.push(muya.domNode);

        // 511 paragraphs + an empty container fill the synchronous prefix
        // EXACTLY (512 weight), so the empty container sits at the frontier
        // already mounted — a resolver that starts mounting at the
        // receiver's index + 1 finds that index mounted, makes no progress,
        // and misreads the pending tail as the document end.
        const states = [
            ...Array.from({ length: 511 }, (_, i) => ({
                name: 'paragraph',
                text: `Paragraph ${i}`,
            })),
            { name: 'block-quote', children: [] },
            { name: 'paragraph', text: 'Paragraph after empty container' },
        ];
        muya.setContent(states as never);
        expect(mountedParagraphs(muya)).toBe(511);
        expect(
            (muya.editor.scrollPage!.find(511) as unknown as { blockName: string }).blockName,
        ).toBe('block-quote');

        const frontier = (muya.editor.scrollPage!.find(510) as unknown as {
            lastContentInDescendant: () => {
                text: string;
                setCursor: (start: number, end: number, focus?: boolean) => void;
                arrowHandler: (event: Event) => void;
            };
        }).lastContentInDescendant();
        expect(frontier.text).toBe('Paragraph 510');

        muya.editor.activeContentBlock = frontier as never;
        frontier.setCursor(0, 0, true);
        frontier.arrowHandler(
            new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }),
        );
        muya.editor.jsonState.flush();

        expect(muya.editor.jsonState.rawState).toHaveLength(513);
        expect(muya.domNode.textContent).toContain('Paragraph after empty container');
        vi.runAllTimers();
        expectDomMatchesState(muya);
        muya.destroy();
    });

    it('delete at the end of the frontier paragraph merges with the pending successor (review: delete merge)', () => {
        const muya = bootMuya();
        expect(mountedParagraphs(muya)).toBe(512);

        const frontier = (muya.editor.scrollPage!.find(511) as unknown as {
            lastContentInDescendant: () => {
                text: string;
                setCursor: (start: number, end: number, focus?: boolean) => void;
                deleteHandler: (event: KeyboardEvent) => void;
            };
        }).lastContentInDescendant();
        expect(frontier.text).toBe('Paragraph 511');

        muya.editor.activeContentBlock = frontier as never;
        frontier.setCursor(frontier.text.length, frontier.text.length, true);
        frontier.deleteHandler(
            new KeyboardEvent('keydown', { key: 'Delete', cancelable: true }),
        );
        muya.editor.jsonState.flush();

        // Same as at full mount: the two paragraphs merge — the keystroke is
        // not swallowed by the mount frontier.
        expect(muya.editor.jsonState.rawState).toHaveLength(SECTIONS - 1);
        expect(frontier.text).toBe('Paragraph 511Paragraph 512');
        vi.runAllTimers();
        expectDomMatchesState(muya);
        muya.destroy();
    });

    it('tab out of the last table cell at the frontier reaches the pending successor (review: table tab)', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const parts = Array.from({ length: SECTIONS }, (_, i) => `Paragraph ${i}`);
        parts[550] = '| a | b |\n| - | - |\n| c | d |';
        const muya = new Muya(host, {
            markdown: `${parts.join('\n\n')}\n`,
        } as ConstructorParameters<typeof Muya>[1]);
        muya.init();
        bootedHosts.push(muya.domNode);

        muya.editor.scrollPage!.ensureMountedThrough(550);
        const before = mountedParagraphs(muya);
        const cell = (muya.editor.scrollPage!.find(550) as unknown as {
            lastContentInDescendant: () => {
                text: string;
                setCursor: (start: number, end: number, focus?: boolean) => void;
                tabHandler: (event: Event) => void;
            };
        }).lastContentInDescendant();
        expect(cell.text).toBe('d');

        muya.editor.activeContentBlock = cell as never;
        cell.setCursor(1, 1, true);
        cell.tabHandler(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
        muya.editor.jsonState.flush();

        expect(muya.editor.jsonState.rawState).toHaveLength(SECTIONS);
        expect(mountedParagraphs(muya)).toBeGreaterThan(before);
        expect(muya.domNode.textContent).toContain('Paragraph 551');
        muya.destroy();
    });

    it('destroy cancels a pending mount so timers never fire afterwards', () => {
        const muya = bootMuya();
        expect(mountedParagraphs(muya)).toBe(512);

        muya.destroy();
        expect(() => vi.runAllTimers()).not.toThrow();
    });
});
