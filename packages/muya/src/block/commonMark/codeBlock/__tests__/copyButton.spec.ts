// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyType } from '../../../../clipboard/types';
import { Muya } from '../../../../muya';

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
    vi.useRealTimers();
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

        const button = muya.domNode.querySelector<HTMLElement>('.mu-code-copy');
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

        const button = muya.domNode.querySelector<HTMLElement>('.mu-code-copy')!;
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(copySpy).toHaveBeenCalledTimes(1);
        expect(copySpy).toHaveBeenCalledWith(CopyType.COPY_CODE_CONTENT, 'solo line');
    });

    it.each(['false', 'reject'])('restores the accessible label after a %s clipboard failure', async (failure) => {
        vi.useFakeTimers();
        const writer = failure === 'reject'
            ? vi.fn().mockRejectedValue(new Error('clipboard unavailable'))
            : vi.fn().mockResolvedValue(false);
        const muya = bootMuya(THREE_LINE_FENCE, { clipboardWriteText: writer });
        const button = muya.domNode.querySelector<HTMLButtonElement>('.mu-code-copy')!;
        button.click();
        await vi.advanceTimersByTimeAsync(0);
        expect(button.getAttribute('aria-label')).toBe(muya.i18n.t('Copy failed'));
        expect(button.dataset.copyFeedback).toBe(muya.i18n.t('Copy failed'));
        await vi.advanceTimersByTimeAsync(2000);
        expect(button.getAttribute('aria-label')).toBe(muya.i18n.t('Copy content'));
        expect(button.dataset.copyFeedback).toBeUndefined();
    });

    it.each(['code', 'heading'])('shows a check for two seconds after copying %s', async (kind) => {
        vi.useFakeTimers();
        const writer = vi.fn().mockResolvedValue(true);
        const muya = bootMuya(kind === 'code' ? THREE_LINE_FENCE : '# Heading', { clipboardWriteText: writer });
        muya.on('heading-copy-link', ({ onCopied }: { onCopied: (ok: boolean) => void }) => {
            void writer('#heading').then(onCopied);
        });
        const button = muya.domNode.querySelector<HTMLElement>(kind === 'code' ? '.mu-code-copy' : '.mu-copy-header-link')!;
        const label = button.getAttribute('aria-label');
        button.click();
        await vi.advanceTimersByTimeAsync(0);
        expect(button.classList.contains('mu-copy-success')).toBe(true);
        expect(button.dataset.copyFeedback).toBeUndefined();
        await vi.advanceTimersByTimeAsync(1000);
        button.click();
        await vi.advanceTimersByTimeAsync(1000);
        expect(button.classList.contains('mu-copy-success')).toBe(true);
        await vi.advanceTimersByTimeAsync(1000);
        expect(button.classList.contains('mu-copy-success')).toBe(false);
        expect(button.getAttribute('aria-label')).toBe(label);
    });

    it('preventDefaults the mousedown so the caret/selection does not move', () => {
        const muya = bootMuya(THREE_LINE_FENCE);

        const button = muya.domNode.querySelector<HTMLElement>('.mu-code-copy')!;
        const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        button.dispatchEvent(mousedown);

        expect(mousedown.defaultPrevented).toBe(true);
    });
});
