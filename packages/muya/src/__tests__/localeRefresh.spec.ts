// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { en, zhCN } from '../locales';
import { Muya } from '../muya';

// PARITY (Phase G — G8): switching the UI language mid-session must refresh the
// inline placeholder hints (quick-insert "Type / to insert…", code-block
// language, math, front matter). Those hints are DOM attributes baked once in
// each block's constructor, so `Muya.locale()` re-renders the block tree to
// re-apply them. Legacy muyajs achieved this via CSS custom properties;
// `@muyajs/core` did nothing until this fix.

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
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, {
        markdown,
        locale: en,
    } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

describe('muya.locale() refreshes rendered hints (Phase G — G8)', () => {
    it('updates an empty paragraph\'s quick-insert hint attribute', () => {
        const muya = bootMuya('\n');
        const para = muya.editor.scrollPage!.firstContentInDescendant()!;
        const before = para.domNode!.getAttribute('empty-hint');
        expect(before).toBe(en.resource['Type / to insert...']);

        muya.locale(zhCN);

        // The block was re-rendered, so query the fresh DOM node.
        const after = muya.editor.scrollPage!
            .firstContentInDescendant()!
            .domNode!
            .getAttribute('empty-hint');
        expect(after).toBe(zhCN.resource['Type / to insert...']);
        expect(after).not.toBe(before);
    });

    it('updates the code-block language-input hint attribute', () => {
        const muya = bootMuya('```\n\n```\n');
        const findLangInput = (): Element | null =>
            muya.domNode.querySelector('[hint]');
        expect(findLangInput()?.getAttribute('hint')).toBe(
            en.resource['Input Language Identifier...'],
        );

        muya.locale(zhCN);

        expect(findLangInput()?.getAttribute('hint')).toBe(
            zhCN.resource['Input Language Identifier...'],
        );
    });

    it('preserves the undo history across the locale refresh', async () => {
        const muya = bootMuya('alpha\n');
        // Seed an undo entry. The text-setter op flushes to history on the next
        // frame (JSONState._emitStateChange), so wait for the stack to grow.
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        first.setCursor(5, 5, true);
        muya.editor.activeContentBlock = first;
        first.text = 'alpha beta';
        await vi.waitFor(() => {
            expect(muya.getHistory().stack.undo.length).toBeGreaterThan(0);
        });
        const before = muya.getHistory();

        muya.locale(zhCN);

        const after = muya.getHistory();
        expect(after.stack.undo.length).toBe(before.stack.undo.length);
        // Document content is untouched by a pure language switch.
        expect(muya.getMarkdown().trim()).toBe('alpha beta');
    });

    it('restores the caret across the locale refresh', () => {
        const muya = bootMuya('hello world\n');
        const block = muya.editor.scrollPage!.firstContentInDescendant()!;
        block.setCursor(5, 5, true);

        muya.locale(zhCN);

        const sel = muya.editor.selection.getSelection();
        expect(sel).not.toBeNull();
        expect(sel!.anchor.offset).toBe(5);
        expect(sel!.anchorBlock.text).toBe('hello world');
    });

    it('is a no-op-safe re-render when the tree is not yet mounted', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const muya = new Muya(host, {
            markdown: 'text\n',
            locale: en,
        } as ConstructorParameters<typeof Muya>[1]);
        bootedHosts.push(host);
        // No init() yet — scrollPage is undefined. locale() must not throw.
        expect(() => muya.locale(zhCN)).not.toThrow();
        expect(muya.i18n.lang).toBe('zh-CN');
    });
});
