// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { Muya } from '../../../../muya';

function boot(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    return muya;
}

interface ILangInput {
    domNode: HTMLElement;
    inputHandler: () => void;
}

function firstLangInput(muya: Muya): ILangInput {
    const codeBlock = muya.editor.scrollPage!.firstChild as unknown as {
        firstContentInDescendant: () => ILangInput;
    };
    return codeBlock.firstContentInDescendant();
}

describe('language input edits the whole info string (#4770 follow-up)', () => {
    it('keeps a typed multi-word info string instead of truncating it', () => {
        const muya = boot('```js\nx\n```\n');
        const li = firstLangInput(muya);
        // Emulate typing the full info string into the language input, with the
        // caret inside it (inputHandler reads the live selection).
        li.domNode.textContent = 'js title="app.js"';
        const range = document.createRange();
        range.selectNodeContents(li.domNode);
        range.collapse(false);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);

        li.inputHandler();
        muya.editor.jsonState.flush();
        expect(muya.getMarkdown().split('\n')[0]).toBe('```js title="app.js"');
    });
});
