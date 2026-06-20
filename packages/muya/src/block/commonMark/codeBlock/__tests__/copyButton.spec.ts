// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyType } from '../../../../clipboard/types';
import { Muya } from '../../../../muya';

// Characterization coverage for the code-block copy button wiring
// (Code._listen, code.ts:104-134). copyHandler.spec only exercises the
// downstream COPY_CODE_CONTENT setData branch — the button-click →
// editor.clipboard.copy(CopyType.COPY_CODE_CONTENT, text) hookup is otherwise
// untested. The button is the `a.mu-code-copy` first child of the `.mu-code`
// node; clicking it copies the raw code text verbatim, and mousedown
// preventDefaults so the caret/selection does not move.

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
    vi.restoreAllMocks();
});

function bootMuya(markdown: string, options: Record<string, unknown> = {}): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, ...options } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

const THREE_LINE_FENCE = '```js\nconst a = 1\nconst b = 2\nconst c = 3\n```\n';

describe('code-block copy button', () => {
    it('invokes editor.clipboard.copy(COPY_CODE_CONTENT, codeText) on click', () => {
        const muya = bootMuya(THREE_LINE_FENCE);
        const copySpy = vi.spyOn(muya.editor.clipboard, 'copy').mockImplementation(() => {});

        const button = muya.domNode.querySelector<HTMLElement>('a.mu-code-copy');
        expect(button).not.toBeNull();

        button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(copySpy).toHaveBeenCalledTimes(1);
        expect(copySpy).toHaveBeenCalledWith(
            CopyType.COPY_CODE_CONTENT,
            'const a = 1\nconst b = 2\nconst c = 3',
        );
    });

    it('copies the raw text verbatim for a single-line block', () => {
        const muya = bootMuya('```js\nsolo line\n```\n');
        const copySpy = vi.spyOn(muya.editor.clipboard, 'copy').mockImplementation(() => {});

        const button = muya.domNode.querySelector<HTMLElement>('a.mu-code-copy')!;
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(copySpy).toHaveBeenCalledTimes(1);
        expect(copySpy).toHaveBeenCalledWith(CopyType.COPY_CODE_CONTENT, 'solo line');
    });

    it('preventDefaults the mousedown so the caret/selection does not move', () => {
        const muya = bootMuya(THREE_LINE_FENCE);

        const button = muya.domNode.querySelector<HTMLElement>('a.mu-code-copy')!;
        const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        button.dispatchEvent(mousedown);

        expect(mousedown.defaultPrevented).toBe(true);
    });
});
