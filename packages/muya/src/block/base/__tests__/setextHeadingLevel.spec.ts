// @vitest-environment happy-dom

import type { Muya } from '../../../muya';
import type SetextHeading from '../../commonMark/setextHeading';
import type Format from '../format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../../muya';

// Typing a setext underline must produce the CommonMark level: `===` → level 1
// (h1), `---` → level 2 (h2). Regression: `_convertToSetextHeading` inverted
// the test (`/=/ ? 2 : 1`), so `===` rendered as an h2 until a source-mode
// round-trip re-parsed it.

vi.mock('../../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => Promise.resolve([]),
    search: () => [],
}));

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new MuyaClass(host, { markdown } as ConstructorParameters<typeof MuyaClass>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function convertViaUnderline(underline: string): SetextHeading {
    const muya = bootMuya('hello world\n');
    const content = muya.editor.scrollPage!.firstContentInDescendant() as Format;
    content.text = `hello world\n${underline}`;
    content.checkInlineUpdate();

    return muya.editor.scrollPage!.firstChild as unknown as SetextHeading;
}

describe('setext heading conversion uses the CommonMark level', () => {
    it('`===` underline creates a level-1 heading (h1)', () => {
        const heading = convertViaUnderline('===');

        expect(heading.blockName).toBe('setext-heading');
        expect(heading.meta.level).toBe(1);
        expect(heading.tagName).toBe('h1');
    });

    it('`---` underline creates a level-2 heading (h2)', () => {
        const heading = convertViaUnderline('---');

        expect(heading.blockName).toBe('setext-heading');
        expect(heading.meta.level).toBe(2);
        expect(heading.tagName).toBe('h2');
    });
});
