// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

// marktext #4687 follow-through: once a format combo is no longer claimed by
// an embedder accelerator or the toolbar's internal handler (e.g. Cmd+B after
// rebinding Bold), the keystroke reaches the contenteditable and Chromium's
// NATIVE rich-text editing kicks in — styling the DOM behind the model's
// back, invisible to the serialized markdown. The editor must cancel every
// `format*` beforeinput; the model is the only writer of formatting.

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) bootedHosts.pop()!.remove();
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function dispatchBeforeInput(muya: Muya, inputType: string): boolean {
    const event = new Event('beforeinput', { cancelable: true, bubbles: true });
    Object.defineProperty(event, 'inputType', { value: inputType });
    muya.domNode.dispatchEvent(event);
    return event.defaultPrevented;
}

describe('native rich-text formatting is suppressed', () => {
    it.each(['formatBold', 'formatItalic', 'formatUnderline', 'formatStrikeThrough'])(
        'cancels a %s beforeinput',
        (inputType) => {
            const muya = bootMuya('hello world\n');
            expect(dispatchBeforeInput(muya, inputType)).toBe(true);
        },
    );

    it('leaves text insertion and composition untouched', () => {
        const muya = bootMuya('hello world\n');
        expect(dispatchBeforeInput(muya, 'insertText')).toBe(false);
        expect(dispatchBeforeInput(muya, 'insertCompositionText')).toBe(false);
    });

    it('leaves history inputTypes untouched', () => {
        const muya = bootMuya('hello world\n');
        expect(dispatchBeforeInput(muya, 'historyUndo')).toBe(false);
    });
});
