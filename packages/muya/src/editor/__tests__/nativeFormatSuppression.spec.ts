// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

let muya: Muya;
beforeEach(() => {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.appendChild(host);
    muya = new Muya(host, { markdown: 'audit' });
    muya.init();
});
afterEach(() => muya.destroy());

describe('model-owned formatting', () => {
    it.each(['formatBold', 'formatItalic', 'formatUnderline', 'formatStrikeThrough'])('cancels native %s', (inputType) => {
        const event = new InputEvent('beforeinput', { inputType, bubbles: true, cancelable: true });
        muya.domNode.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(muya.getMarkdown()).toBe('audit\n');
    });

    it.each(['insertText', 'insertCompositionText', 'insertFromPaste', 'deleteContentBackward', 'historyUndo', 'historyRedo'])('preserves %s', (inputType) => {
        const event = new InputEvent('beforeinput', { inputType, bubbles: true, cancelable: true });
        muya.domNode.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
    });

    it('does not intercept formatting in another editable surface', () => {
        const input = document.createElement('input');
        document.body.appendChild(input);
        const event = new InputEvent('beforeinput', { inputType: 'formatBold', bubbles: true, cancelable: true });
        input.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
        input.remove();
    });
});
