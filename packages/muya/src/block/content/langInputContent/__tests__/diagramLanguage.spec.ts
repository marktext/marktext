// @vitest-environment happy-dom

import type Content from '../../../base/content';
import type Parent from '../../../base/parent';
import type LangInputContent from '../index';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../../muya';

// #5060: leaving a code block's language input commits the language. A diagram
// language turns the block into a diagram block — what loading its ```lang
// fence produces — instead of leaving a code block with no preview.

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

function block(muya: Muya, index: number): Parent {
    return muya.editor.scrollPage!.find(index) as Parent;
}

function typeLanguage(muya: Muya, lang: string): LangInputContent {
    const langInput = block(muya, 0).firstContentInDescendant() as LangInputContent;
    langInput.setCursor(0, 0, true);
    langInput.updateLanguage(lang);
    return langInput;
}

async function settle(): Promise<void> {
    await Promise.resolve();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

describe('leaving the language input with a diagram language', () => {
    it('turns the code block into a mermaid diagram that keeps the code', async () => {
        const muya = bootMuya('```\ngraph TD\n```\n');
        typeLanguage(muya, 'mermaid');

        block(muya, 0).lastContentInDescendant()!.setCursor(0, 0, true);
        await settle();

        expect(muya.getState()).toEqual([
            { name: 'diagram', text: 'graph TD', meta: { type: 'mermaid', lang: 'yaml' } },
        ]);
    });

    it('gives a vega-lite diagram json as its code language', async () => {
        const muya = bootMuya('```\n{}\n```\n');
        typeLanguage(muya, 'vega-lite');

        block(muya, 0).lastContentInDescendant()!.setCursor(0, 0, true);
        await settle();

        expect(muya.getState()[0]).toMatchObject({ name: 'diagram', meta: { type: 'vega-lite', lang: 'json' } });
    });

    it('keys off the first word of the info string, like loading the fence', async () => {
        const muya = bootMuya('```\ngraph TD\n```\n');
        typeLanguage(muya, 'mermaid title=x');

        block(muya, 0).lastContentInDescendant()!.setCursor(0, 0, true);
        await settle();

        expect(muya.getState()[0]).toMatchObject({ name: 'diagram', meta: { type: 'mermaid' } });
    });

    it('moves the caret into the diagram code when it went into the code block', async () => {
        const muya = bootMuya('```\ngraph TD\n```\n');
        typeLanguage(muya, 'mermaid');

        block(muya, 0).lastContentInDescendant()!.setCursor(0, 0, true);
        await settle();

        expect(muya.editor.activeContentBlock?.outMostBlock?.blockName).toBe('diagram');
    });

    it('leaves the caret in another block the user moved to', async () => {
        const muya = bootMuya('```\ngraph TD\n```\n\nafter\n');
        typeLanguage(muya, 'mermaid');
        const after = block(muya, 1).firstContentInDescendant() as Content;

        after.setCursor(0, 0, true);
        await settle();

        expect(muya.getState()[0].name).toBe('diagram');
        expect(muya.editor.activeContentBlock).toBe(after);
    });
});

describe('the language input does not convert', () => {
    it('for a non-diagram language', async () => {
        const muya = bootMuya('```\ncode\n```\n');
        typeLanguage(muya, 'python');

        block(muya, 0).lastContentInDescendant()!.setCursor(0, 0, true);
        await settle();

        expect(muya.getState()).toEqual([
            { name: 'code-block', text: 'code', meta: { type: 'fenced', lang: 'python' } },
        ]);
    });

    it('while the caret is still in the language input', async () => {
        const muya = bootMuya('```\ngraph TD\n```\n');
        typeLanguage(muya, 'mermaid');

        await settle();

        expect(muya.getState()[0].name).toBe('code-block');
    });

    it('when the document was replaced before the conversion ran', async () => {
        const muya = bootMuya('```\ngraph TD\n```\n');
        typeLanguage(muya, 'mermaid');

        block(muya, 0).lastContentInDescendant()!.setCursor(0, 0, true);
        muya.setContent('replaced\n');
        await settle();

        expect(muya.getState()).toEqual([{ name: 'paragraph', text: 'replaced' }]);
    });
});
