// @vitest-environment happy-dom

import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// #4851 — Japanese IME input breaks when typing into a code block: the first
// kana commits, the second and later characters are corrupted ("ｎあ" / repeated
// kana). Root cause: codeBlockContent.inputHandler ends every path in
// setCursor(offset, offset, true) -> update(), and update() runs
// `domNode.innerHTML = code`, which DESTROYS and recreates the content text
// node. composeHandler drives inputHandler synchronously on compositionend (and
// Chromium fires a trailing `insertCompositionText` input that runs it again),
// so committing char 1 replaces the very text node the IME is still anchored to;
// char 2's compositionstart then begins against a fresh node and the IME loses
// its composition. Paragraphs are immune because format.inputHandler skips
// update() for a plain CJK commit and calls setCursor WITHOUT needUpdate.
//
// The glyph-level corruption is IME-internal and unreproducible headlessly. The
// observable invariant a fix must preserve — and that these tests pin — is that
// an IME commit inside a code block must NOT synchronously replace the content
// DOM node, while normal typing must still re-highlight.

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

// Empty-LANGUAGE fenced block: update() takes the plain `innerHTML = code`
// branch (no Prism), so the node replacement is synchronous and deterministic —
// this is exactly the reporter's scenario (``` with no language, then Enter).
const EMPTY_CODE_BLOCK = '```\nx\n```\n';

// A committed kana sitting in the content node with the caret after it — the
// DOM state at the instant a per-character compositionend fires.
function seedCommittedKana(content: Content): void {
    content.text = 'て';
    content.setCursor(1, 1, true);
}

describe('codeBlockContent IME re-render (#4851)', () => {
    it('does NOT replace the content text node on compositionend', () => {
        const muya = bootMuya(EMPTY_CODE_BLOCK);
        const content = codeContent(muya);
        muya.editor.activeContentBlock = content;
        seedCommittedKana(content);

        const textNodeBefore = content.domNode!.firstChild;
        expect(textNodeBefore).not.toBeNull();
        expect(textNodeBefore!.nodeType).toBe(Node.TEXT_NODE);
        expect(textNodeBefore!.textContent).toBe('て');

        // Char 1 commit — the exact sequence composeHandler drives.
        content.composeHandler(new Event('compositionstart'));
        content.composeHandler(new Event('compositionend'));

        // The IME is still anchored to this node while char 2 composes; char 1's
        // commit must not destroy it.
        expect(content.domNode!.firstChild).toBe(textNodeBefore);
        expect(content.text).toBe('て');
    });

    it('also survives the trailing insertCompositionText input Chromium fires', () => {
        const muya = bootMuya(EMPTY_CODE_BLOCK);
        const content = codeContent(muya);
        muya.editor.activeContentBlock = content;
        seedCommittedKana(content);
        const textNodeBefore = content.domNode!.firstChild;

        content.composeHandler(new Event('compositionstart'));
        content.composeHandler(new Event('compositionend'));
        // Chromium fires this AFTER compositionend (isComposing:false); it lands
        // between compositionend#1 and compositionstart#2, so it must not replace
        // the node either.
        content.inputHandler(new InputEvent('input', {
            inputType: 'insertCompositionText',
            data: 'て',
            isComposing: false,
        }));

        expect(content.domNode!.firstChild).toBe(textNodeBefore);
        expect(content.text).toBe('て');
    });

    it('still re-highlights the code block after the IME settles (deferred, not lost)', () => {
        const muya = bootMuya(EMPTY_CODE_BLOCK);
        const content = codeContent(muya);
        muya.editor.activeContentBlock = content;
        seedCommittedKana(content);

        vi.useFakeTimers();
        try {
            const updateSpy = vi.spyOn(content, 'update');

            content.composeHandler(new Event('compositionstart'));
            content.composeHandler(new Event('compositionend'));
            // No synchronous rebuild on the commit (that is what breaks the IME).
            expect(updateSpy).not.toHaveBeenCalled();

            // Once typing pauses, the highlight rebuild runs exactly once.
            vi.runOnlyPendingTimers();
            expect(updateSpy).toHaveBeenCalledTimes(1);
        }
        finally {
            vi.useRealTimers();
        }
    });

    it('still re-renders synchronously on a normal (non-composition) input', () => {
        const muya = bootMuya(EMPTY_CODE_BLOCK);
        const content = codeContent(muya);
        muya.editor.activeContentBlock = content;
        content.text = 'ab';
        content.setCursor(2, 2, true);

        const updateSpy = vi.spyOn(content, 'update');
        content.inputHandler(new InputEvent('input', {
            inputType: 'insertText',
            data: 'b',
            isComposing: false,
        }));

        // Normal typing must keep re-highlighting immediately — the fix is
        // scoped to composition and must not disable code-block rendering.
        expect(updateSpy).toHaveBeenCalled();
        expect(content.text).toBe('ab');
    });
});
